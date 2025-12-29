// apps/backend/src/modules/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import { DbUserRole } from '../../db/schema/users';

export interface JwtPayload {
  sub: number;
  email: string;
  role: DbUserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET') ?? 'change-me';

    const fromBearer = ExtractJwt.fromAuthHeaderAsBearerToken();

    const fromCookie = (req?: Request) => {
      if (!req) return null;

      // Support multiple *ACCESS TOKEN* cookie names for backward compatibility / migration.
      // Primary (current): anor_at
      // IMPORTANT: Do NOT accept refresh-token cookies here. This strategy protects API routes and
      // must only validate an access token.
      const COOKIE_CANDIDATES = [
        'anor_at',
        'anor_access_token',
        'anorAccessToken',
        'access_token',
        'accessToken',
        'at',
      ];

      // 1) Preferred: cookie-parser (or equivalent) populates req.cookies.
      const cookieBag = (req as any)?.cookies;
      if (cookieBag && typeof cookieBag === 'object') {
        for (const key of COOKIE_CANDIDATES) {
          const v = cookieBag[key];
          if (typeof v === 'string' && v.length > 0) return v;
        }
      }

      // 2) Fallback: parse the raw Cookie header so auth still works even if
      // cookie-parser is not installed/registered.
      const header = (req as any)?.headers?.cookie;
      if (typeof header !== 'string' || header.length === 0) return null;

      // Tiny cookie parser: "k=v; k2=v2" -> map
      const map: Record<string, string> = {};
      for (const part of header.split(';')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const k = trimmed.slice(0, eq).trim();
        const rawVal = trimmed.slice(eq + 1);
        if (!k || !rawVal) continue;

        // Cookies may be URL-encoded; decode if possible.
        try {
          map[k] = decodeURIComponent(rawVal);
        } catch {
          map[k] = rawVal;
        }
      }

      for (const key of COOKIE_CANDIDATES) {
        const v = map[key];
        if (typeof v === 'string' && v.length > 0) return v;
      }

      return null;
    };

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromBearer, fromCookie]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
