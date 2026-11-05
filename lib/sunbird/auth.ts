/**
 * Sunbird AI auth (spec §3b): OAuth2 password flow at POST /auth/token
 * (application/x-www-form-urlencoded: username, password) → { access_token, token_type }.
 * Tokens last 7 days; cached server-side and refreshed on 401 or near expiry.
 * The token never reaches the browser.
 */
const TOKEN_TTL_MS = 6.5 * 24 * 3600 * 1000;

let cache: { token: string; expiresAt: number } | null = null;

export function sunbirdBaseUrl(): string {
  return (process.env.SUNBIRD_BASE_URL || 'https://api.sunbird.ai').replace(/\/$/, '');
}

export function sunbirdConfigured(): boolean {
  return Boolean(process.env.SUNBIRD_USERNAME && process.env.SUNBIRD_PASSWORD);
}

export async function sunbirdToken(force = false): Promise<string> {
  if (!force && cache && cache.expiresAt > Date.now()) return cache.token;
  const body = new URLSearchParams({ username: process.env.SUNBIRD_USERNAME!, password: process.env.SUNBIRD_PASSWORD!, grant_type: 'password' });
  const res = await fetch(`${sunbirdBaseUrl()}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Sunbird sign-in failed (${res.status}).`);
  const data = (await res.json()) as { access_token: string };
  cache = { token: data.access_token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return cache.token;
}

/** fetch with the bearer token; refreshes the token once on 401. */
export async function sunbirdFetch(path: string, init: (token: string) => RequestInit): Promise<Response> {
  let res = await fetch(`${sunbirdBaseUrl()}${path}`, init(await sunbirdToken()));
  if (res.status === 401) res = await fetch(`${sunbirdBaseUrl()}${path}`, init(await sunbirdToken(true)));
  return res;
}
