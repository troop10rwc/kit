import type { MiddlewareHandler } from "hono";
import { LEADER_POSITIONS, type Identity, type Position, type Role } from "@troop10rwc/shared";

/* ============================================================================
   @troop10rwc/worker-kit
   Worker-side building blocks shared across apps. Runs in the Workers runtime
   (workerd): use WebCrypto / fetch globals, never node builtins.
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

/* ----------------------------------------------------------------------------
   Cloudflare Access JWT verification (RS256 via team JWKS, WebCrypto).
   Ported from scoutpack/src/worker/auth.ts; same logic, throws instead of
   returning null so failures don't get silently confused with "no JWT".
   -------------------------------------------------------------------------- */

export interface VerifyOptions {
  /** Either `troop10rwc` or `troop10rwc.cloudflareaccess.com` — both accepted. */
  teamDomain: string;
  /** Access application audience (AUD) tag. Apps with multiple Access apps
   *  (e.g. production + preview) should pick the right AUD per request before
   *  calling verifyAccessJwt. */
  audience: string;
}

const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour
type Jwk = JsonWebKey & { kid?: string };
// Module-level cache, keyed by team host so a hypothetical multi-team Worker
// doesn't mix keys. Per-instance — fine for Workers (no shared state across
// instances).
const jwksCache = new Map<string, { keys: Jwk[]; expires: number }>();

function teamDomainHost(value: string): string {
  // Accept short form ("troop10rwc") or full hostname.
  return value.includes(".") ? value : `${value}.cloudflareaccess.com`;
}

async function getSigningKeys(teamDomain: string): Promise<Jwk[]> {
  const host = teamDomainHost(teamDomain);
  const cached = jwksCache.get(host);
  if (cached && cached.expires > Date.now()) return cached.keys;
  const res = await fetch(`https://${host}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access JWKS fetch failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { keys?: Jwk[] };
  const keys = data.keys ?? [];
  jwksCache.set(host, { keys, expires: Date.now() + JWKS_TTL_MS });
  return keys;
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeSegment<T>(s: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s))) as T;
}

interface AccessHeader { kid?: string; alg?: string; }
interface AccessPayload {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  email?: string;
  custom?: Record<string, unknown> & { groups?: string[]; name?: string };
  groups?: string[];
}

function decodePayload(jwt: string): AccessPayload {
  const [, p] = jwt.split(".");
  if (!p) throw new Error("invalid Access JWT: missing payload segment");
  try {
    return decodeSegment<AccessPayload>(p);
  } catch (e) {
    throw new Error(`invalid Access JWT: malformed payload (${(e as Error).message})`);
  }
}

/**
 * Extract group memberships from a Cloudflare Access JWT. Access surfaces them
 * either as a top-level `groups` claim or nested in `custom.groups`, depending
 * on the IdP/SAML mapping — both are handled.
 *
 * Decoding only — no signature check. Call this after `verifyAccessJwt`
 * succeeds (typically inside an `inLeaderGroup` callback for `withAuth`).
 */
export function getAccessGroups(jwt: string): string[] {
  const p = decodePayload(jwt);
  const g = p.groups ?? p.custom?.groups;
  return Array.isArray(g) ? g.filter((x): x is string => typeof x === "string") : [];
}

/**
 * Verify a Cloudflare Access JWT and return the caller identity.
 *
 * Checks: 3-segment structure, decodable header/payload, `iss` matches the team
 * domain, `aud` includes the configured audience, `exp` in the future, JWKS key
 * for the header's `kid`, RS256 signature valid. Throws an Error with a
 * descriptive message on the first failed check.
 */
export async function verifyAccessJwt(jwt: string, opts: VerifyOptions): Promise<Identity> {
  const [h, p, sig] = jwt.split(".");
  if (!h || !p || !sig) throw new Error("invalid Access JWT: expected 3 segments");

  let header: AccessHeader;
  let payload: AccessPayload;
  try {
    header = decodeSegment<AccessHeader>(h);
    payload = decodeSegment<AccessPayload>(p);
  } catch (e) {
    throw new Error(`invalid Access JWT: malformed header/payload (${(e as Error).message})`);
  }

  const expectedIss = `https://${teamDomainHost(opts.teamDomain)}`;
  if (payload.iss !== expectedIss) {
    throw new Error(`invalid Access JWT: iss mismatch (expected ${expectedIss})`);
  }
  const aud = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  if (!aud.includes(opts.audience)) {
    throw new Error("invalid Access JWT: aud mismatch");
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) {
    throw new Error("invalid Access JWT: expired");
  }

  const jwk = (await getSigningKeys(opts.teamDomain)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("invalid Access JWT: no JWKS key matches kid");

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  // TS 5.9's lib narrows BufferSource to ArrayBuffer-backed views; Uint8Array's
  // generic ArrayBufferLike default trips it. Both inputs here are fresh
  // ArrayBuffer-backed — cast to satisfy the signature without copying.
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    b64urlToBytes(sig) as BufferSource,
    new TextEncoder().encode(`${h}.${p}`) as BufferSource,
  );
  if (!ok) throw new Error("invalid Access JWT: bad signature");

  const email = String(payload.email ?? "");
  if (!email) throw new Error("invalid Access JWT: missing email");
  const name = String(payload.custom?.name ?? email);
  return { email, name };
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

    let identity: Identity;
    try {
      identity = await verifyAccessJwt(jwt, deps.verify);
    } catch {
      return c.json({ error: "unauthorized" }, 401);
    }
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
