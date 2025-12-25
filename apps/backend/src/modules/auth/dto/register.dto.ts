// apps/backend/src/modules/auth/dto/register.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: '邮箱格式不正确' })
  @MaxLength(128, { message: '邮箱长度不能超过 128 个字符' })
  email!: string;

  @IsString({ message: '密码必须是字符串' })
  @MinLength(8, { message: '密码长度至少 8 位' })
  @MaxLength(64, { message: '密码长度不能超过 64 位' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/, {
    message: '密码至少 8 位，且必须包含大写字母、小写字母、数字和特殊符号',
  })
  password!: string;
}
