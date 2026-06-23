import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
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

/* ============================================================================
   Member sessions — Slack-enrollment + passkey auth (replaces Cloudflare Access)

   The identity service (id.troop10rwc.org) mints an opaque session token, stores
   a row in D1, and sets it as the shared `__Secure-troop_session` cookie scoped
   to the parent domain. Every app Worker validates with `requireSession`, which
   looks the token up in the SAME D1 (Option B — strongly consistent, instant
   revocation). The identity service itself is built separately; this is the
   reusable middleware app Workers consume, plus the canonical cookie/lookup
   contracts so issuer and verifier can't drift.

   LOAD-BEARING: the cookie is `Domain=troop10rwc.org`, so it NEVER reaches
   `*.workers.dev` preview hosts. Apps that rely on preview deploys can't run the
   session path there — keep the Access path (`withAuth`) for previews and gate on
   session vs Access per environment. Don't "simplify" the Access branch away.
   ========================================================================== */

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Identity carried by a validated session. `sub` is the Slack OIDC `sub` (the
 *  stable member id); name/email are best-effort display fields from `users`. */
export interface SessionIdentity {
  sub: string;
  name?: string;
  email?: string;
}

/** Hono env augmentation so handlers can read `c.var.session`. */
export interface SessionVariables {
  Variables: { session: SessionIdentity };
}

/* ---- Session cookie (the §7 contract — issuer and verifier share it) ------ *
   __Secure- prefix (NOT __Host-, which forbids Domain and would defeat SSO),
   Domain=parent so the cookie reaches every subdomain, SameSite=Lax so the
   app→auth→app redirect bounce carries it.                                     */

export const SESSION_COOKIE_NAME = "__Secure-troop_session";
/** Parent registrable domain the cookie is scoped to (SSO across subdomains). */
export const SESSION_COOKIE_DOMAIN = "troop10rwc.org";
/** Default session lifetime: 12h. Passkey re-auth is one tap, so short is cheap. */
export const SESSION_MAX_AGE = 43200;

export interface SessionCookieOptions {
  /** Parent domain for SSO. Defaults to `SESSION_COOKIE_DOMAIN`. */
  domain?: string;
  /** Lifetime in seconds. Defaults to `SESSION_MAX_AGE`. */
  maxAge?: number;
}

/** Build the `Set-Cookie` value the auth Worker uses to issue a session. */
export function buildSessionCookie(token: string, opts: SessionCookieOptions = {}): string {
  const domain = opts.domain ?? SESSION_COOKIE_DOMAIN;
  const maxAge = opts.maxAge ?? SESSION_MAX_AGE;
  return `${SESSION_COOKIE_NAME}=${token}; Domain=${domain}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Build the `Set-Cookie` value that clears the session (logout / offboarding). */
export function clearSessionCookie(opts: { domain?: string } = {}): string {
  const domain = opts.domain ?? SESSION_COOKIE_DOMAIN;
  return `${SESSION_COOKIE_NAME}=; Domain=${domain}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/* ---- D1 session lookup (Option B) ----------------------------------------- *
   The canonical query lives here so every app agrees on it. LEFT JOIN so a
   session still validates if the `users` row is ever absent; expiry is enforced
   in code (D1 has no clock predicate we want to rely on here).                 */

interface SessionRow {
  sub: string;
  expires_at: number;
  name: string | null;
  email: string | null;
}

/**
 * Build a session resolver bound to a D1 database. Returns the member identity
 * for a live token, or `null` when the token is unknown or expired. Bind the
 * SAME D1 the auth Worker writes to (Option B requires shared, consistent state).
 */
export function d1SessionLookup(db: D1Database): (token: string) => Promise<SessionIdentity | null> {
  return async (token) => {
    const row = await db
      .prepare(
        "SELECT s.slack_sub AS sub, s.expires_at AS expires_at, u.name AS name, u.email AS email " +
          "FROM sessions s LEFT JOIN users u ON u.slack_sub = s.slack_sub WHERE s.id = ?",
      )
      .bind(token)
      .first<SessionRow>();
    if (!row) return null;
    if (!row.expires_at || row.expires_at < nowSeconds()) return null;
    return { sub: row.sub, name: row.name ?? undefined, email: row.email ?? undefined };
  };
}

export interface RequireSessionDeps {
  /** Identity service origin for the login redirect, e.g. "https://id.troop10rwc.org". */
  authOrigin: string;
  /** D1 binding; used to build the default lookup when `lookup` is omitted. */
  db?: D1Database;
  /** Custom resolver. Defaults to `d1SessionLookup(db)`. Provide one of `db`/`lookup`. */
  lookup?: (token: string) => Promise<SessionIdentity | null>;
  /** Cookie name. Defaults to `SESSION_COOKIE_NAME`. */
  cookieName?: string;
  /**
   * Response for an unauthenticated request:
   * - "redirect" (default): 302 to `${authOrigin}/login?redirect=<current url>` — HTML Workers.
   * - "json": 401 `{ error: "unauthorized" }` — API/fetch Workers.
   */
  onUnauthenticated?: "redirect" | "json";
  /** Local-dev escape hatch (DEV_AUTH_BYPASS=1). */
  devBypass?: SessionIdentity;
}

/**
 * Middleware that validates the session cookie and attaches the identity to
 * `c.var.session`. Fails closed: a missing/unknown/expired token — or a lookup
 * error — is treated as unauthenticated. Swap this in for `withAuth` once an app
 * moves off Cloudflare Access.
 */
export function requireSession(deps: RequireSessionDeps): MiddlewareHandler {
  const cookieName = deps.cookieName ?? SESSION_COOKIE_NAME;
  const authOrigin = deps.authOrigin.replace(/\/$/, "");
  const lookup = deps.lookup ?? (deps.db ? d1SessionLookup(deps.db) : null);
  if (!lookup) throw new Error("requireSession: provide either `db` or `lookup`");

  return async (c, next) => {
    if (deps.devBypass) {
      c.set("session", deps.devBypass);
      return next();
    }
    const token = getCookie(c, cookieName);
    let session: SessionIdentity | null = null;
    if (token) {
      try {
        session = await lookup(token);
      } catch {
        session = null; // fail closed
      }
    }
    if (!session) {
      if (deps.onUnauthenticated === "json") return c.json({ error: "unauthorized" }, 401);
      const back = encodeURIComponent(c.req.url);
      return c.redirect(`${authOrigin}/login?redirect=${back}`, 302);
    }
    c.set("session", session);
    return next();
  };
}
