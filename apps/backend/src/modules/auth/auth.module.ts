// apps/backend/src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { DbModule } from '../../db/db.module';
import { UsersRepository } from '../users/users.repository';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';   
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    DbModule,
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET') ?? 'change-me';
        const expiresIn = config.get<number>('JWT_EXPIRES_IN') ?? 3600;

        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, 
    UsersRepository, 
    JwtStrategy, 
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AuthService, 
    JwtAuthGuard,
    RolesGuard, 
  ],
})
export class AuthModule {}