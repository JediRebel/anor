// apps/backend/src/modules/auth/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { User } from '../../db/schema/users';

// 直接复用 User 表里的 role 类型，避免字符串写错
export type RequestUserRole = User['role'];

// 在 metadata 里保存要求的角色列表
export const ROLES_KEY = 'roles';

export const Roles = (...roles: RequestUserRole[]) =>
  SetMetadata(ROLES_KEY, roles);
