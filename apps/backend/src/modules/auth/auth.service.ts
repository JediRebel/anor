// apps/backend/src/modules/auth/auth.service.ts
import {
  BadRequestException,
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
    admin: 1 * 60,
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

  // 修改密码：校验当前密码 -> 写入新密码 hash
  // 说明：此处只负责更新密码，不负责重签 token / 清 cookie（由 controller 处理）
  // 兼容两种调用方式：
  // 1) changePassword(userId, currentPassword, newPassword)
  // 2) changePassword({ userId, currentPassword, newPassword })
  async changePassword(
    userIdOrDto:
      | number
      | { userId: number; currentPassword: string; newPassword: string },
    currentPassword?: string,
    newPassword?: string,
  ): Promise<{ ok: true }> {
    // 0) 统一参数（兼容 controller 误传对象的情况）
    const rawUserId =
      typeof userIdOrDto === 'number' ? userIdOrDto : userIdOrDto.userId;

    // 兼容 req.user.sub 可能是 string 的情况
    const userId =
      typeof rawUserId === 'string'
        ? Number.parseInt(rawUserId, 10)
        : (rawUserId as number);

    const current =
      typeof userIdOrDto === 'number'
        ? currentPassword
        : userIdOrDto.currentPassword;
    const next =
      typeof userIdOrDto === 'number' ? newPassword : userIdOrDto.newPassword;

    if (!Number.isFinite(userId) || userId <= 0) {
      throw new BadRequestException('无效的 userId');
    }

    if (!current || !next) {
      throw new BadRequestException(
        '参数不完整：需要 currentPassword/newPassword',
      );
    }

    // 1) 读取用户（兼容不同仓库方法命名）
    const repo: any = this.usersRepo as any;

    const findById = async (id: any): Promise<User | null> => {
      return (
        (typeof repo.findById === 'function'
          ? await repo.findById(id)
          : typeof repo.findUserById === 'function'
            ? await repo.findUserById(id)
            : typeof repo.getUserById === 'function'
              ? await repo.getUserById(id)
              : typeof repo.findOneById === 'function'
                ? await repo.findOneById(id)
                : typeof repo.getById === 'function'
                  ? await repo.getById(id)
                  : null) ?? null
      );
    };

    // 先按 number 查
    const userByNumber: User | null = await findById(userId);

    // 再按 string(id) 查（很多 ORM/仓库把 id 当 string 处理）
    const userByString: User | null = userByNumber
      ? null
      : await findById(String(userId));

    // 极少数情况：controller 传入的是 string（这里也兜底一次）
    const userByRaw: User | null =
      userByNumber || userByString
        ? null
        : typeof rawUserId === 'string'
          ? await findById(rawUserId)
          : null;

    const user: User | null = userByNumber ?? userByString ?? userByRaw;

    // 为后续更新使用与查询一致的 id 形态
    const idForRepo: any = userByNumber
      ? userId
      : userByString
        ? String(userId)
        : rawUserId;

    if (!user) {
      throw new UnauthorizedException('用户不存在或登录已失效，请重新登录');
    }

    // 2) 校验当前密码
    const storedHash =
      (user as any).passwordHash ?? (user as any).password_hash;
    if (!storedHash) {
      throw new UnauthorizedException('用户密码数据异常，请联系管理员');
    }

    const ok = await bcrypt.compare(current, storedHash);
    if (!ok) {
      throw new UnauthorizedException('当前密码不正确');
    }

    // 3) 写入新密码 hash（兼容不同仓库方法命名）
    const passwordHash = await bcrypt.hash(next, 10);

    if (typeof repo.updatePasswordHash === 'function') {
      await repo.updatePasswordHash(idForRepo, passwordHash);
    } else if (typeof repo.updateUserPasswordHash === 'function') {
      await repo.updateUserPasswordHash(idForRepo, passwordHash);
    } else if (typeof repo.setPasswordHash === 'function') {
      await repo.setPasswordHash(idForRepo, passwordHash);
    } else if (typeof repo.updateUser === 'function') {
      // 最后兜底：常见的 updateUser(userId, { ... }) 形态
      await (repo.updateUser as any)(idForRepo, {
        passwordHash,
        password_hash: passwordHash,
      });
    } else {
      // 如果仓库没有实现更新密码的方法，直接抛出可读错误，便于你定位需要补哪个方法
      throw new Error(
        'UsersRepository 缺少更新密码的方法：请实现 updatePasswordHash(userId, passwordHash) 或 updateUser(userId, { passwordHash }) 等方法',
      );
    }

    // 4) 可选校验：再次读取一次，确保更新确实落库（避免 id 类型不一致导致 update 0 行但不报错）
    const verifyUser = await findById(idForRepo);
    const verifyHash =
      (verifyUser as any)?.passwordHash ?? (verifyUser as any)?.password_hash;
    if (!verifyUser || !verifyHash) {
      throw new Error('密码更新后校验失败：用户读取异常');
    }

    const verifyOk = await bcrypt.compare(next, verifyHash);
    if (!verifyOk) {
      throw new Error(
        '密码更新未生效：请检查 UsersRepository 的更新实现是否正确',
      );
    }

    return { ok: true };
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
