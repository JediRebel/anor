// apps/backend/src/db/schema/index.ts
import { users, userRoleEnum } from './users';

// 如果你之前已经有其他表，就一并放进来
export const schema = {
  users,
  // ...other tables
};

export { users, userRoleEnum };