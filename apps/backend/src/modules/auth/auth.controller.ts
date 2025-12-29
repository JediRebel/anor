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

function setAuthCookies(
  res: Response,
  tokens: { accessToken?: string; refreshToken?: string },
  opts?: { rememberMe?: boolean },
) {
  const { accessToken, refreshToken } = tokens;

  // NOTE: For now we keep returning the JSON response body unchanged.
  // These cookies enable a gradual migration to httpOnly-cookie auth + middleware redirects.
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
  };

  // User expectation:
  // - Default: closing the browser logs the user out (session cookies -> no Expires/Max-Age).
  // - Remember me: keep the refresh token for 7 days on this device.
  const rememberMe = opts?.rememberMe === true;

  // Access-token cookie: session cookie by default (no Max-Age).
  // The real lifetime is still governed by the JWT exp.
  if (typeof accessToken === 'string' && accessToken.length > 0) {
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...base,
    });
  }

  // Refresh-token cookie: session cookie by default; persistent only when rememberMe is enabled.
  if (typeof refreshToken === 'string' && refreshToken.length > 0) {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...base,
      ...(rememberMe ? { maxAge: 1000 * 60 * 60 * 24 * 7 } : {}), // 7 days
    });
  }

  // Store a small marker so the server can preserve remember-me mode on /auth/refresh.
  // (The server cannot infer cookie persistence from incoming requests.)
  if (rememberMe) {
    res.cookie(REMEMBER_ME_COOKIE, '1', {
      ...base,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });
  } else {
    res.clearCookie(REMEMBER_ME_COOKIE, base);
  }
}

function clearAuthCookies(res: Response) {
  const base = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProd,
    path: '/',
  };

  // Must match the cookie options used when setting cookies (path/sameSite/secure)
  res.clearCookie(ACCESS_TOKEN_COOKIE, base);
  res.clearCookie(REFRESH_TOKEN_COOKIE, base);
  res.clearCookie(REMEMBER_ME_COOKIE, base);
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
