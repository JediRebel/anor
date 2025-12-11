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

type AuthUserPayload = Pick<User, 'id' | 'email' | 'role'>;

export interface AuthResult {
  user: AuthUserPayload;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;         // access token 有效期（秒）
  refreshExpiresIn: number;  // refresh token 有效期（秒）
}

@Injectable()
export class AuthService {
  // 先用固定值：1 小时 + 7 天
  private readonly accessExpiresInSeconds = 3600;
  private readonly refreshExpiresInSeconds = 7 * 24 * 60 * 60;

  constructor(
    private readonly usersRepo: UsersRepository,
    private readonly jwtService: JwtService,
  ) {}

  // 注册：创建用户 + 返回带 token 的结果
  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.usersRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
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

  // 内部方法：校验用户凭证
  private async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersRepo.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
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

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.accessExpiresInSeconds,
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.refreshExpiresInSeconds,
    });

    return {
      user,
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiresInSeconds,
      refreshExpiresIn: this.refreshExpiresInSeconds,
    };
  }
}