// apps/backend/src/modules/auth/auth.service.ts
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

import { UsersRepository } from '../users/users.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../../db/schema/users';
import type { JwtPayload } from './jwt.strategy';

type AuthUserPayload = Pick<User, 'id' | 'email' | 'role'>;

export interface AuthResult {
  user: AuthUserPayload;
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token 有效期（秒）
  refreshExpiresIn: number; // refresh token 有效期（秒）
}

@Injectable()
export class AuthService {
  // 按角色配置 AccessToken / RefreshToken 的有效期（单位：秒）
  private readonly accessExpiresConfig: Record<
    AuthUserPayload['role'],
    number
  > = {
    // 管理员：access 30 分钟
    admin: 30 * 60,
    // 付费用户：access 60 分钟（和普通用户保持一致，后续如需调整可单独修改）
    paid_user: 60 * 60,
    // 普通用户：access 60 分钟
    user: 60 * 60,
  };

  private readonly refreshExpiresConfig: Record<
    AuthUserPayload['role'],
    number
  > = {
    // 管理员：refresh 2 小时（最多允许 2 小时内滑动续期）
    admin: 2 * 60 * 60,
    // 付费用户：refresh 7 天（与普通用户一致，便于长期保持登录）
    paid_user: 7 * 24 * 60 * 60,
    // 普通用户：refresh 7 天
    user: 7 * 24 * 60 * 60,
  };

  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  // 注册：创建用户 + 返回带 token 的结果
  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('此邮箱已经被注册，请使用其他邮箱');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await this.usersRepo.createUser({
      email: dto.email,
      passwordHash,
      role: 'user',
    });

    const userPayload: AuthUserPayload = {
      id: created.id,
      email: created.email,
      role: created.role,
    };

    return this.buildAuthResult(userPayload);
  }

  // 登录：校验邮箱 + 密码 + 返回带 token 的结果
  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.validateUser(dto.email, dto.password);

    const userPayload: AuthUserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    return this.buildAuthResult(userPayload);
  }

  // AuthService 里的 refresh 方法
  async refresh(refreshToken: string): Promise<AuthResult> {
    try {
      // 使用我们在 jwt.strategy.ts 里定义的 JwtPayload 类型
      const payload =
        await this.jwtService.verifyAsync<JwtPayload>(refreshToken);

      const userPayload: AuthUserPayload = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      // 复用现有逻辑，重新签发一对新的 access / refresh token
      return this.buildAuthResult(userPayload);
    } catch (e) {
      // refreshToken 本身过期 / 被篡改等
      throw new UnauthorizedException('Refresh token 已失效，请重新登录');
    }
  }

  // 内部方法：校验用户凭证
  private async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('账号密码不匹配，请输入正确的账号和密码');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('账号密码不匹配，请输入正确的账号和密码');
    }

    return user;
  }

  // 内部方法：生成 accessToken + refreshToken，并返回统一结构
  private async buildAuthResult(user: AuthUserPayload): Promise<AuthResult> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // 根据当前用户角色，选择对应的过期时间配置
    const accessExpiresInSeconds =
      this.accessExpiresConfig[user.role] ?? this.accessExpiresConfig.user;
    const refreshExpiresInSeconds =
      this.refreshExpiresConfig[user.role] ?? this.refreshExpiresConfig.user;

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: accessExpiresInSeconds,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: refreshExpiresInSeconds,
    });

    return {
      user,
      accessToken,
      refreshToken,
      expiresIn: accessExpiresInSeconds,
      refreshExpiresIn: refreshExpiresInSeconds,
    };
  }
}
