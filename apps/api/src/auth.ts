import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { Request } from "express";
import type { PoolClient } from "pg";
import type { User } from "@beside/domain/types";
import type { LoginInput, RegisterInput, Session } from "@beside/domain/api";
import { id } from "@beside/domain/model";
import { DatabaseService } from "./db/database.service.ts";
import { createHomebase, joinHomebase } from "./homebases.ts";

const derive = promisify(scrypt);
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export type AuthenticatedRequest = Request & {
  actor: User;
  sessionHash: string;
};
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await derive(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}
async function checkPassword(password: string, hash: string) {
  const [salt, encoded] = hash.split(":");
  const expected = Buffer.from(encoded!, "hex");
  const actual = (await derive(password, salt!, 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async throttle(ip: string) {
    const key = tokenHash(`auth:${ip}`);
    const pool = this.database.getPool();
    await pool.query("DELETE FROM auth_rate_limit WHERE reset_at < now()");
    const result = await pool.query(
      "INSERT INTO auth_rate_limit(key, count, reset_at) VALUES ($1, 1, now() + interval '15 minutes') ON CONFLICT (key) DO UPDATE SET count = auth_rate_limit.count + 1 RETURNING count",
      [key],
    );
    if (result.rows[0].count > 30)
      throw new HttpException(
        "Too many sign-in attempts. Try again in 15 minutes.",
        429,
      );
  }
  private async session(client: PoolClient, user: User): Promise<Session> {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await client.query("DELETE FROM auth_session WHERE expires_at <= now()");
    await client.query(
      "INSERT INTO auth_session(token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
      [tokenHash(token), user.id, expiresAt],
    );
    return { token, expiresAt, user };
  }
  async register(input: RegisterInput) {
    const passwordHash = await hashPassword(input.password);
    return this.database.transaction(true, async (client) => {
      if (
        (
          await client.query("SELECT 1 FROM app_user WHERE email = $1", [
            input.email,
          ])
        ).rowCount
      )
        throw new ConflictException(
          "An account with this email already exists.",
        );
      const user: User = {
        id: id("user"),
        name: input.name,
        email: input.email,
        color: "blue",
      };
      await client.query(
        "INSERT INTO app_user(id, name, email, color) VALUES ($1, $2, $3, $4)",
        [user.id, user.name, user.email, user.color],
      );
      await client.query(
        "INSERT INTO auth_credential(user_id, password_hash) VALUES ($1, $2)",
        [user.id, passwordHash],
      );
      const inviteCode = input.inviteCode?.trim();
      if (inviteCode) await joinHomebase(client, user.id, inviteCode);
      else await createHomebase(client, user.id, `${user.name}'s home base`);
      return this.session(client, user);
    });
  }
  async login(input: LoginInput) {
    const result = await this.database
      .getPool()
      .query(
        "SELECT u.id, u.name, u.email, u.color, c.password_hash FROM app_user u JOIN auth_credential c ON c.user_id = u.id WHERE u.email = $1",
        [input.email],
      );
    const row = result.rows[0];
    // Still derive a key for unknown emails, so timing doesn't trivially expose accounts.
    const valid = await checkPassword(
      input.password,
      row?.password_hash ?? `${"0".repeat(32)}:${"0".repeat(128)}`,
    );
    if (!row || !valid)
      throw new UnauthorizedException("Email or password is incorrect.");
    return this.database.transaction(true, (client) =>
      this.session(client, {
        id: row.id,
        name: row.name,
        email: row.email,
        color: row.color,
      }),
    );
  }
  async authenticate(token: string) {
    const hash = tokenHash(token);
    const result = await this.database
      .getPool()
      .query(
        "SELECT u.id, u.name, u.email, u.color FROM auth_session s JOIN app_user u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()",
        [hash],
      );
    if (!result.rows[0])
      throw new UnauthorizedException(
        "Session is invalid or expired. Sign in again.",
      );
    return { user: result.rows[0] as User, hash };
  }
  async logout(hash: string) {
    await this.database
      .getPool()
      .query("DELETE FROM auth_session WHERE token_hash = $1", [hash]);
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(
      request.headers.authorization ?? "",
    );
    if (!match)
      throw new UnauthorizedException("A bearer session token is required.");
    const { user, hash } = await this.auth.authenticate(match[1]!);
    request.actor = user;
    request.sessionHash = hash;
    return true;
  }
}
