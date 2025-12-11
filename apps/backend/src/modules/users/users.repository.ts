// apps/backend/src/modules/users/users.repository.ts
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { users, User, NewUser } from '../../db/schema/users';

@Injectable()
export class UsersRepository {
  constructor(private readonly db: DbService) {}

  async findByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0];
  }

  async createUser(
    input: Pick<NewUser, 'email' | 'passwordHash' | 'role'>,
  ): Promise<User> {
    const [created] = await this.db.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role ?? 'user',
      })
      .returning();

    return created;
  }
}