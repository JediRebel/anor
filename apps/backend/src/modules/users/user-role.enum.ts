// apps/backend/src/modules/users/user-role.enum.ts

export enum UserRole {
  User = 'user', // 普通用户
  Admin = 'admin', // 管理员
  PaidUser = 'paid_user', // 付费用户（如果暂时不用也可以先保留）
}

// 可选：一个方便遍历/校验的常量
export const ALL_USER_ROLES = [
  UserRole.User,
  UserRole.Admin,
  UserRole.PaidUser,
] as const;
