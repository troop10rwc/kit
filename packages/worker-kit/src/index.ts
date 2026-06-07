import type { MiddlewareHandler } from "hono";
import { LEADER_POSITIONS, type Identity, type Position, type Role } from "@troop10rwc/shared";

/* ============================================================================
   @troop10rwc/worker-kit
   Worker-side building blocks shared across apps. Runs in the Workers runtime
   (workerd): use WebCrypto / fetch globals, never node builtins.

   `roleForPosition` is the real, tested logic. `verifyAccessJwt` and `withAuth`
   are stubs — port your existing scoutpack implementations into them so both
   apps share one copy:
     - src/worker/auth.ts   -> verifyAccessJwt (RS256 via team JWKS, WebCrypto)
     - src/worker/roster.ts -> the D1 lookup that feeds withAuth
   ========================================================================== */

const LEADER_SET: ReadonlySet<Position> = new Set(LEADER_POSITIONS);

/**
 * Resolve effective role from the roster. An explicit position row always wins;
 * a member with no row inherits leader from the Access group fallback so the
 * troop is never locked out before anyone is assigned.
 */
export function roleForPosition(position: Position | null, inLeaderGroup: boolean): Role {
  if (position) return LEADER_SET.has(position) ? "leader" : "scout";
  return inLeaderGroup ? "leader" : "scout";
}

export interface VerifyOptions {
  /** e.g. "troop10rwc" -> https://troop10rwc.cloudflareaccess.com */
  teamDomain: string;
  /** Access application audience (AUD) tag. */
  audience: string;
}

/**
 * Verify a Cloudflare Access JWT (RS256, team JWKS, WebCrypto) and return the
 * caller identity. Throws on any failure. Port from src/worker/auth.ts.
 */
export async function verifyAccessJwt(_jwt: string, _opts: VerifyOptions): Promise<Identity> {
  throw new Error("worker-kit: port the WebCrypto RS256 verification from src/worker/auth.ts");
}

/** Hono env augmentation so handlers can read c.var.identity / c.var.role. */
export interface AuthVariables {
  Variables: { identity: Identity; role: Role };
}

export interface AuthDeps {
  verify: VerifyOptions;
  /** Look up a member's explicit position (null if none) — your D1 query. */
  lookupPosition: (email: string) => Promise<Position | null>;
  /** Read the LEADER_GROUP membership from the Access claim. */
  inLeaderGroup: (jwt: string) => boolean;
  /** Local-dev escape hatch (DEV_AUTH_BYPASS=1). */
  devBypass?: Identity;
}

/**
 * Middleware that verifies Access, resolves the roster role, and attaches both
 * to the context. Wire `lookupPosition` to D1 in each app.
 */
export function withAuth(deps: AuthDeps): MiddlewareHandler {
  return async (c, next) => {
    if (deps.devBypass) {
      c.set("identity", deps.devBypass);
      c.set("role", "leader");
      return next();
    }
    const jwt = c.req.header("Cf-Access-Jwt-Assertion");
    if (!jwt) return c.json({ error: "missing Access assertion" }, 401);

    const identity = await verifyAccessJwt(jwt, deps.verify);
    const position = await deps.lookupPosition(identity.email);
    c.set("identity", identity);
    c.set("role", roleForPosition(position, deps.inLeaderGroup(jwt)));
    return next();
  };
}

/** Guard for leader-only routes (template/event/roster edits). */
export function requireLeader(): MiddlewareHandler {
  return async (c, next) => {
    if (c.get("role") !== "leader") return c.json({ error: "leader role required" }, 403);
    return next();
  };
}
