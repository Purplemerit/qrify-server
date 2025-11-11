// src/lib/jwt.ts
import jwt, {
  type JwtPayload,
  type Secret,
  type SignOptions,
} from "jsonwebtoken";
import { env } from "../config/env.js";

type AnyPayload = JwtPayload | Record<string, unknown>;

export function signJwt(
  payload: AnyPayload,
  options: SignOptions = {}
): string {
  const secret: Secret = env.JWT_SECRET;

  return jwt.sign(payload, secret, {
    ...options,
    expiresIn: env.JWT_EXPIRES_IN as unknown as number, // 👈 fixes the TS error
  });
}

export function verifyJwt<T extends AnyPayload = AnyPayload>(
  token: string
): T {
  const secret: Secret = env.JWT_SECRET;
  return jwt.verify(token, secret) as T;
}
