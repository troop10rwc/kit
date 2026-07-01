import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthVariables,
  type SessionIdentity,
  type SessionVariables,
  buildSessionCookie,
  clearSessionCookie,
  d1SessionLookup,
  getAccessGroups,
  requireLeader,
  requireSession,
  roleForPosition,
  SESSION_COOKIE_NAME,
  verifyAccessJwt,
  withAuth,
} from "./index.js";

/* ---------------- JWT fixture helpers (sign + encode in-memory) -------------- */

const enc = new TextEncoder();

function b64url(bytes: Uint8Array | string): string {
  const u8 = typeof bytes === "string" ? enc.encode(bytes) : bytes;
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const b64urlJson = (obj: unknown) => b64url(JSON.stringify(obj));

interface KeyPair {
  publicJwk: JsonWebKey & { kid: string };
  signingKey: CryptoKey;
}

async function makeRsaKey(kid: string): Promise<KeyPair> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { publicJwk: { ...jwk, kid }, signingKey: pair.privateKey };
}

interface SignOpts {
  header?: Record<string, unknown>;
  payload: Record<string, unknown>;
  kid: string;
  key: CryptoKey;
}
async function signJwt({ header, payload, kid, key }: SignOpts): Promise<string> {
  const h = b64urlJson({ alg: "RS256", typ: "JWT", kid, ...(header ?? {}) });
  const p = b64urlJson(payload);
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(`${h}.${p}`) as BufferSource,
  );
  return `${h}.${p}.${b64url(new Uint8Array(sigBuf))}`;
}

/** Stub the global fetch so the verifier's JWKS lookup returns our public key. */
function stubJwks(keys: JsonWebKey[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ keys }), {
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Each test uses a unique teamDomain so the module-level JWKS cache (keyed by
 *  host) doesn't carry state across tests. */
let teamCounter = 0;
const freshTeam = () => `t${++teamCounter}-${Date.now()}`;

/** A signed-and-verified JWT factory shared by the verifier tests. Returns the
 *  pieces a test usually needs to assert on. */
async function makeValidJwt(overrides: {
  payload?: Record<string, unknown>;
  team?: string;
  audience?: string;
} = {}) {
  const team = overrides.team ?? freshTeam();
  const audience = overrides.audience ?? "test-aud";
  const kid = "test-kid";
  const { publicJwk, signingKey } = await makeRsaKey(kid);
  const payload = {
    iss: `https://${team}.cloudflareaccess.com`,
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 300,
    email: "alice@troop10rwc.org",
    custom: { name: "Alice Example" },
    ...(overrides.payload ?? {}),
  };
  const jwt = await signJwt({ payload, kid, key: signingKey });
  const fetchMock = stubJwks([publicJwk]);
  return { jwt, team, audience, payload, fetchMock };
}

/* ---------------------------- verifyAccessJwt ---------------------------- */

describe("verifyAccessJwt", () => {
  it("accepts a valid JWT and returns { email, name }", async () => {
    const { jwt, team, audience } = await makeValidJwt();
    const id = await verifyAccessJwt(jwt, { teamDomain: team, audience });
    expect(id).toEqual({ email: "alice@troop10rwc.org", name: "Alice Example" });
  });

  it("falls back to email when custom.name is missing", async () => {
    const { jwt, team, audience } = await makeValidJwt({ payload: { custom: {} } });
    const id = await verifyAccessJwt(jwt, { teamDomain: team, audience });
    expect(id.name).toBe("alice@troop10rwc.org");
  });

  it("accepts short-form teamDomain and appends .cloudflareaccess.com", async () => {
    const team = freshTeam();
    const { jwt, audience } = await makeValidJwt({ team });
    const id = await verifyAccessJwt(jwt, { teamDomain: team, audience });
    expect(id.email).toBe("alice@troop10rwc.org");
  });

  it("accepts full-hostname teamDomain unchanged", async () => {
    const team = freshTeam();
    const { jwt, audience } = await makeValidJwt({ team });
    const id = await verifyAccessJwt(jwt, {
      teamDomain: `${team}.cloudflareaccess.com`,
      audience,
    });
    expect(id.email).toBe("alice@troop10rwc.org");
  });

  it("accepts aud given as a single string or an array", async () => {
    const team = freshTeam();
    const { jwt, audience } = await makeValidJwt({
      team,
      payload: { aud: ["other-aud", "test-aud", "extra"] },
    });
    expect(
      (await verifyAccessJwt(jwt, { teamDomain: team, audience })).email,
    ).toBe("alice@troop10rwc.org");
  });

  it("caches JWKS — second verify against the same team makes no extra fetch", async () => {
    const { jwt, team, audience, fetchMock } = await makeValidJwt();
    await verifyAccessJwt(jwt, { teamDomain: team, audience });
    await verifyAccessJwt(jwt, { teamDomain: team, audience });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects empty / 1-segment / 2-segment JWTs", async () => {
    for (const bad of ["", "abc", "a.b"]) {
      await expect(
        verifyAccessJwt(bad, { teamDomain: "any", audience: "x" }),
      ).rejects.toThrow(/expected 3 segments/);
    }
  });

  it("rejects non-JSON header/payload", async () => {
    await expect(
      verifyAccessJwt("!!!.!!!.zzz", { teamDomain: "any", audience: "x" }),
    ).rejects.toThrow(/malformed header\/payload/);
  });

  it("rejects iss mismatch", async () => {
    const team = freshTeam();
    const { jwt, audience } = await makeValidJwt({
      team,
      payload: { iss: "https://attacker.example/" },
    });
    await expect(
      verifyAccessJwt(jwt, { teamDomain: team, audience }),
    ).rejects.toThrow(/iss mismatch/);
  });

  it("rejects aud mismatch", async () => {
    const { jwt, team } = await makeValidJwt();
    await expect(
      verifyAccessJwt(jwt, { teamDomain: team, audience: "wrong-aud" }),
    ).rejects.toThrow(/aud mismatch/);
  });

  it("rejects expired tokens", async () => {
    const team = freshTeam();
    const { jwt, audience } = await makeValidJwt({
      team,
      payload: { exp: Math.floor(Date.now() / 1000) - 60 },
    });
    await expect(
      verifyAccessJwt(jwt, { teamDomain: team, audience }),
    ).rejects.toThrow(/expired/);
  });

  it("rejects tokens with no JWKS key for the kid", async () => {
    // Issue a JWT with a kid the JWKS doesn't carry.
    const team = freshTeam();
    const audience = "test-aud";
    const { signingKey } = await makeRsaKey("known-kid");
    const { publicJwk: otherPublic } = await makeRsaKey("different-kid");
    const jwt = await signJwt({
      kid: "known-kid",
      key: signingKey,
      payload: {
        iss: `https://${team}.cloudflareaccess.com`,
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 300,
        email: "a@b",
      },
    });
    stubJwks([otherPublic]);
    await expect(
      verifyAccessJwt(jwt, { teamDomain: team, audience }),
    ).rejects.toThrow(/no JWKS key matches kid/);
  });

  it("rejects a bad signature (payload tampered after signing)", async () => {
    const team = freshTeam();
    const audience = "test-aud";
    const { publicJwk, signingKey } = await makeRsaKey("k1");
    const jwt = await signJwt({
      kid: "k1",
      key: signingKey,
      payload: {
        iss: `https://${team}.cloudflareaccess.com`,
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 300,
        email: "alice@troop10rwc.org",
      },
    });
    // Swap the payload segment for one with a different email — header/sig stay.
    const [h, , s] = jwt.split(".");
    const tamperedPayload = b64urlJson({
      iss: `https://${team}.cloudflareaccess.com`,
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 300,
      email: "attacker@evil",
    });
    stubJwks([publicJwk]);
    await expect(
      verifyAccessJwt(`${h}.${tamperedPayload}.${s}`, { teamDomain: team, audience }),
    ).rejects.toThrow(/bad signature/);
  });

  it("rejects tokens with empty email", async () => {
    const team = freshTeam();
    const { jwt, audience } = await makeValidJwt({ team, payload: { email: "" } });
    await expect(
      verifyAccessJwt(jwt, { teamDomain: team, audience }),
    ).rejects.toThrow(/missing email/);
  });

  it("surfaces JWKS fetch HTTP errors", async () => {
    // Sign normally but make fetch return 503.
    const team = freshTeam();
    const audience = "test-aud";
    const { signingKey } = await makeRsaKey("k1");
    const jwt = await signJwt({
      kid: "k1",
      key: signingKey,
      payload: {
        iss: `https://${team}.cloudflareaccess.com`,
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 300,
        email: "a@b",
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
    await expect(
      verifyAccessJwt(jwt, { teamDomain: team, audience }),
    ).rejects.toThrow(/JWKS fetch failed: 503/);
  });
});

/* ---------------------------- getAccessGroups ---------------------------- */

describe("getAccessGroups", () => {
  function fakeJwt(payload: unknown): string {
    return `h.${b64urlJson(payload)}.s`;
  }

  it("reads a top-level groups claim", () => {
    expect(getAccessGroups(fakeJwt({ groups: ["leaders", "parents"] }))).toEqual([
      "leaders",
      "parents",
    ]);
  });

  it("reads a nested custom.groups claim", () => {
    expect(
      getAccessGroups(fakeJwt({ custom: { groups: ["scouts"] } })),
    ).toEqual(["scouts"]);
  });

  it("prefers top-level groups over custom.groups when both are present", () => {
    expect(
      getAccessGroups(
        fakeJwt({ groups: ["top"], custom: { groups: ["nested"] } }),
      ),
    ).toEqual(["top"]);
  });

  it("returns [] when neither claim is present", () => {
    expect(getAccessGroups(fakeJwt({ email: "a@b" }))).toEqual([]);
  });

  it("returns [] when groups is not an array (defensive)", () => {
    expect(getAccessGroups(fakeJwt({ groups: "leaders" }))).toEqual([]);
  });

  it("filters non-string entries", () => {
    expect(
      getAccessGroups(fakeJwt({ groups: ["leaders", 42, null, "scouts"] })),
    ).toEqual(["leaders", "scouts"]);
  });

  it("throws on a malformed payload segment", () => {
    expect(() => getAccessGroups("h..s")).toThrow(/missing payload segment/);
    expect(() => getAccessGroups("h.!!!.s")).toThrow(/malformed payload/);
  });
});

/* ---------------------------- roleForPosition ---------------------------- */

describe("roleForPosition", () => {
  it.each([
    ["scoutmaster", false, "leader"],
    ["assistant_scoutmaster", false, "leader"],
    ["crew_advisor", false, "leader"],
    ["assistant_crew_advisor", false, "leader"],
    ["senior_patrol_leader", false, "leader"],
    ["quartermaster", false, "leader"],
    ["scout", true, "scout"], // explicit override beats group fallback
    ["scout", false, "scout"],
  ] as const)("position=%s group=%s => %s", (pos, group, expected) => {
    expect(roleForPosition(pos, group)).toBe(expected);
  });

  it("returns leader for no-position + group=true (bootstrap fallback)", () => {
    expect(roleForPosition(null, true)).toBe("leader");
  });

  it("returns scout for no-position + group=false (default)", () => {
    expect(roleForPosition(null, false)).toBe("scout");
  });
});

/* -------------------------- withAuth + requireLeader -------------------- */

describe("withAuth", () => {
  type Env = AuthVariables & { Bindings: Record<string, never> };

  function makeApp(opts: Parameters<typeof withAuth>[0]) {
    const app = new Hono<Env>();
    app.use("*", withAuth(opts));
    app.get("/whoami", (c) =>
      c.json({ identity: c.var.identity, role: c.var.role }),
    );
    app.get("/leader-only", requireLeader(), (c) => c.json({ ok: true }));
    return app;
  }

  it("devBypass: returns the bypass identity and forces leader role", async () => {
    const app = makeApp({
      verify: { teamDomain: "x", audience: "y" },
      lookupPosition: async () => null,
      inLeaderGroup: () => false,
      devBypass: { email: "dev@local", name: "Dev" },
    });
    const res = await app.request("/whoami");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      identity: { email: "dev@local", name: "Dev" },
      role: "leader",
    });
  });

  it("401s when no Cf-Access-Jwt-Assertion header is present", async () => {
    const app = makeApp({
      verify: { teamDomain: "x", audience: "y" },
      lookupPosition: async () => null,
      inLeaderGroup: () => false,
    });
    const res = await app.request("/whoami");
    expect(res.status).toBe(401);
  });

  it("401s when JWT verification throws (without leaking the reason)", async () => {
    const app = makeApp({
      verify: { teamDomain: "x", audience: "y" },
      lookupPosition: async () => null,
      inLeaderGroup: () => false,
    });
    const res = await app.request("/whoami", {
      headers: { "Cf-Access-Jwt-Assertion": "bogus.token.value" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("resolves identity + role for a verified JWT (position present)", async () => {
    const { jwt, team, audience } = await makeValidJwt();
    const lookupPosition = vi.fn(async () => "assistant_scoutmaster" as const);
    const app = makeApp({
      verify: { teamDomain: team, audience },
      lookupPosition,
      inLeaderGroup: () => false,
    });
    const res = await app.request("/whoami", {
      headers: { "Cf-Access-Jwt-Assertion": jwt },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      identity: { email: "alice@troop10rwc.org", name: "Alice Example" },
      role: "leader",
    });
    expect(lookupPosition).toHaveBeenCalledWith("alice@troop10rwc.org");
  });

  it("falls back to inLeaderGroup when lookupPosition returns null", async () => {
    const { jwt, team, audience } = await makeValidJwt();
    const inLeaderGroup = vi.fn(() => true);
    const app = makeApp({
      verify: { teamDomain: team, audience },
      lookupPosition: async () => null,
      inLeaderGroup,
    });
    const res = await app.request("/whoami", {
      headers: { "Cf-Access-Jwt-Assertion": jwt },
    });
    expect(((await res.json()) as { role: string }).role).toBe("leader");
    expect(inLeaderGroup).toHaveBeenCalled();
  });
});

describe("requireLeader", () => {
  type Env = AuthVariables & { Bindings: Record<string, never> };

  function appWithRole(role: "leader" | "scout") {
    const app = new Hono<Env>();
    app.use("*", async (c, next) => {
      c.set("identity", { email: "a@b", name: "A" });
      c.set("role", role);
      await next();
    });
    app.get("/leader-only", requireLeader(), (c) => c.json({ ok: true }));
    return app;
  }

  it("passes through for leader", async () => {
    const res = await appWithRole("leader").request("/leader-only");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("403s for scout", async () => {
    const res = await appWithRole("scout").request("/leader-only");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "leader role required" });
  });
});

/* -------------------------- session cookie helpers ---------------------- */

describe("session cookie helpers", () => {
  it("buildSessionCookie uses the __Secure- prefix with a Domain (SSO, not __Host-)", () => {
    const c = buildSessionCookie("tok123");
    expect(c).toMatch(/^__Secure-troop_session=tok123;/);
    expect(c).not.toContain("__Host-");
    expect(c).toContain("Domain=troop10rwc.org");
    expect(c).toContain("Path=/");
    expect(c).toContain("Secure");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Max-Age=43200");
  });

  it("buildSessionCookie honors custom domain + maxAge", () => {
    const c = buildSessionCookie("t", { domain: "example.org", maxAge: 60 });
    expect(c).toContain("Domain=example.org");
    expect(c).toContain("Max-Age=60");
  });

  it("clearSessionCookie expires the cookie (Max-Age=0) with the same scope", () => {
    const c = clearSessionCookie();
    expect(c).toMatch(/^__Secure-troop_session=;/);
    expect(c).toContain("Domain=troop10rwc.org");
    expect(c).toContain("Max-Age=0");
  });
});

/* ---------------------------- d1SessionLookup --------------------------- */

/** Minimal D1 stub: prepare().bind(token).first<T>() returns rows[token] ?? null. */
function fakeDb(rows: Record<string, SessionRowLike | undefined>): D1Database {
  return {
    prepare: () => ({
      bind: (token: string) => ({
        first: async () => rows[token] ?? null,
      }),
    }),
  } as unknown as D1Database;
}
interface SessionRowLike {
  sub: string;
  expires_at: number;
  name: string | null;
  email: string | null;
}
const future = () => nowSec() + 300;
const past = () => nowSec() - 60;
const nowSec = () => Math.floor(Date.now() / 1000);

describe("d1SessionLookup", () => {
  it("returns the identity for a live session", async () => {
    const db = fakeDb({
      good: { sub: "U1", expires_at: future(), name: "Alice", email: "a@troop10rwc.org" },
    });
    expect(await d1SessionLookup(db)("good")).toEqual({
      sub: "U1",
      name: "Alice",
      email: "a@troop10rwc.org",
    });
  });

  it("maps null name/email to undefined", async () => {
    const db = fakeDb({ good: { sub: "U1", expires_at: future(), name: null, email: null } });
    expect(await d1SessionLookup(db)("good")).toEqual({ sub: "U1" });
  });

  it("returns null for an unknown token", async () => {
    expect(await d1SessionLookup(fakeDb({}))("missing")).toBeNull();
  });

  it("returns null for an expired session", async () => {
    const db = fakeDb({
      stale: { sub: "U1", expires_at: past(), name: "A", email: "a@b" },
    });
    expect(await d1SessionLookup(db)("stale")).toBeNull();
  });
});

/* ---------------------------- requireSession ---------------------------- */

describe("requireSession", () => {
  type Env = SessionVariables & { Bindings: Record<string, never> };

  function makeApp(opts: Parameters<typeof requireSession>[0]) {
    const app = new Hono<Env>();
    app.use("*", requireSession(opts));
    app.get("/me", (c) => c.json({ session: c.var.session }));
    return app;
  }

  const authOrigin = "https://auth.troop10rwc.org";
  const cookieFor = (token: string) => ({ Cookie: `${SESSION_COOKIE_NAME}=${token}` });
  const alice: SessionIdentity = { sub: "U1", name: "Alice", email: "a@troop10rwc.org" };

  it("devBypass: attaches the bypass identity without a cookie", async () => {
    const app = makeApp({ authOrigin, lookup: async () => null, devBypass: alice });
    const res = await app.request("/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session: alice });
  });

  it("attaches the session for a valid token", async () => {
    const lookup = vi.fn(async () => alice);
    const app = makeApp({ authOrigin, lookup });
    const res = await app.request("/me", { headers: cookieFor("tok") });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ session: alice });
    expect(lookup).toHaveBeenCalledWith("tok");
  });

  it("redirects to the auth Worker login (preserving the return url) when no cookie", async () => {
    const app = makeApp({ authOrigin, lookup: async () => null });
    const res = await app.request("http://calendar.troop10rwc.org/event/5");
    expect(res.status).toBe(302);
    const loc = res.headers.get("location")!;
    expect(loc.startsWith(`${authOrigin}/login?redirect=`)).toBe(true);
    expect(loc).toContain(encodeURIComponent("http://calendar.troop10rwc.org/event/5"));
  });

  it("redirects for an unknown / expired token", async () => {
    const app = makeApp({ authOrigin, lookup: async () => null });
    const res = await app.request("/me", { headers: cookieFor("stale") });
    expect(res.status).toBe(302);
  });

  it("json mode returns 401 instead of redirecting", async () => {
    const app = makeApp({ authOrigin, lookup: async () => null, onUnauthenticated: "json" });
    const res = await app.request("/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("fails closed (redirect) when the lookup throws", async () => {
    const app = makeApp({
      authOrigin,
      lookup: async () => {
        throw new Error("D1 down");
      },
    });
    const res = await app.request("/me", { headers: cookieFor("tok") });
    expect(res.status).toBe(302);
  });

  it("strips a trailing slash from authOrigin", async () => {
    const app = makeApp({ authOrigin: `${authOrigin}/`, lookup: async () => null });
    const res = await app.request("/me");
    expect(res.headers.get("location")!.startsWith(`${authOrigin}/login`)).toBe(true);
  });

  it("works end-to-end against d1SessionLookup with a bound D1", async () => {
    const db = fakeDb({ live: { sub: "U9", expires_at: future(), name: "Bob", email: "b@b" } });
    const app = makeApp({ authOrigin, db });
    const ok = await app.request("/me", { headers: cookieFor("live") });
    expect(await ok.json()).toEqual({ session: { sub: "U9", name: "Bob", email: "b@b" } });
    const miss = await app.request("/me", { headers: cookieFor("nope") });
    expect(miss.status).toBe(302);
  });

  it("throws if neither db nor lookup is provided", () => {
    expect(() => requireSession({ authOrigin })).toThrow(/provide either/);
  });
});
