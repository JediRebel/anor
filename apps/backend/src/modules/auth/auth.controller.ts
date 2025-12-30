// apps/backend/src/modules/auth/auth.controller.ts

import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';

import type { Response } from 'express';
import { IsString, MinLength } from 'class-validator';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

const isProd = process.env.NODE_ENV === 'production';

function parseRememberMe(body: any): boolean {
  const raw = body?.rememberMe;

  // Boolean from JSON payloads
  if (raw === true) return true;
  if (raw === false) return false;

  // Number / numeric string
  if (raw === 1 || raw === '1') return true;
  if (raw === 0 || raw === '0') return false;

  // Common checkbox / string representations
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    if (v === 'true' || v === 'on' || v === 'yes') return true;
    if (v === 'false' || v === 'off' || v === 'no') return false;
  }

  return false;
}

const ACCESS_TOKEN_COOKIE = 'anor_at';
const REFRESH_TOKEN_COOKIE = 'anor_rt';
const REMEMBER_ME_COOKIE = 'anor_rm';

// 定义一个新的标记 Cookie 名称
const LOGIN_STATUS_COOKIE = 'login_status';

function setAuthCookies(
  res: Response,
  tokens: { accessToken?: string; refreshToken?: string },
  opts?: { rememberMe?: boolean },
) {
  const { accessToken, refreshToken } = tokens;

  // 基础配置：HttpOnly，防止 XSS 读取 Token
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
  };

  const rememberMe = opts?.rememberMe === true;

  // 1. 设置 Access Token
  if (typeof accessToken === 'string' && accessToken.length > 0) {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...base,
    });
  }

  // 2. 设置 Refresh Token
  if (typeof refreshToken === 'string' && refreshToken.length > 0) {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...base,
      ...(rememberMe ? { maxAge: 1000 * 60 * 60 * 24 * 7 } : {}), // 7 days
    });

    // [新增] 3. 设置登录状态标记 Cookie (非 HttpOnly，前端可读)
    // 它的过期时间与 Refresh Token 保持一致
    res.cookie(LOGIN_STATUS_COOKIE, '1', {
      ...base,
      httpOnly: false, // 关键：允许前端 JS 读取
      ...(rememberMe ? { maxAge: 1000 * 60 * 60 * 24 * 7 } : {}),
    });
  }

  // 4. 设置 Remember Me 标记 (供后端逻辑使用)
  if (rememberMe) {
    res.cookie(REMEMBER_ME_COOKIE, '1', {
      ...base,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
  } else {
    res.clearCookie(REMEMBER_ME_COOKIE, base);
  }
}

function clearAuthCookies(res: Response) {
  const base = {
    httpOnly: true, // 注意：清除 cookie 时 options 需要匹配
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
  };

  res.clearCookie(ACCESS_TOKEN_COOKIE, base);
  res.clearCookie(REFRESH_TOKEN_COOKIE, base);
  res.clearCookie(REMEMBER_ME_COOKIE, base);

  // [新增] 清除登录状态标记 (注意 httpOnly: false)
  res.clearCookie(LOGIN_STATUS_COOKIE, { ...base, httpOnly: false });
}

function readRefreshTokenFromRequest(req: any, body: any): string | undefined {
  const fromBody = body?.refreshToken;
  if (typeof fromBody === 'string' && fromBody.length > 0) return fromBody;

  // Requires cookie-parser middleware to populate req.cookies; if not present, this will be undefined.
  const fromCookie = req?.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length > 0)
    return fromCookie;

  return undefined;
}

class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const dto: RegisterDto = {
      email: body?.email,
      password: body?.password,
    } as any;

    const rememberMe = parseRememberMe(body);

    const result = await this.authService.register(dto);

    setAuthCookies(
      res,
      {
        accessToken: (result as any)?.accessToken,
        refreshToken: (result as any)?.refreshToken,
      },
      { rememberMe },
    );

    return result;
  }

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const dto: LoginDto = {
      email: body?.email,
      password: body?.password,
    } as any;

    const rememberMe = parseRememberMe(body);

    const result = await this.authService.login(dto);

    setAuthCookies(
      res,
      {
        accessToken: (result as any)?.accessToken,
        refreshToken: (result as any)?.refreshToken,
      },
      { rememberMe },
    );

    return result;
  }

  @Post('refresh')
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = readRefreshTokenFromRequest(req, body);
    const result = await this.authService.refresh(refreshToken as any);

    const rememberMe = req?.cookies?.[REMEMBER_ME_COOKIE] === '1';

    // Keep cookies in sync (supports refresh-token rotation).
    setAuthCookies(
      res,
      {
        accessToken: (result as any)?.accessToken,
        refreshToken: (result as any)?.refreshToken,
      },
      { rememberMe },
    );

    // Cookie-first mode: do not leak tokens in the JSON body.
    // Backward compatibility: if a client explicitly posts refreshToken in body,
    // we keep returning the original payload.
    const refreshProvidedInBody =
      typeof body?.refreshToken === 'string' && body.refreshToken.length > 0;

    if (refreshProvidedInBody) return result;
    return { ok: true };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookies(res);
    return { ok: true };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = req?.user?.id ?? req?.user?.sub;
    if (userId === undefined || userId === null || userId === '') {
      throw new UnauthorizedException('Unauthorized');
    }

    await this.authService.changePassword(
      userId as any,
      dto.currentPassword,
      dto.newPassword,
    );

    // After password change, force re-login (recommended).
    clearAuthCookies(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: any) {
    // JwtStrategy.validate 的返回值会挂在 req.user 上
    return req.user;
  }
}
