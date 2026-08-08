import type { CatalogPage } from "./types";

type UpstreamError = Error & {
  status: number;
  payload: unknown;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw Object.assign(new Error(`${name} is required`), { status: 500 });
  }
  return value;
}

export function getPresenterUrl(): string {
  return (
    process.env.PRESENTER_URL ||
    "https://cdn.perxona.ai/asia/prod/latest/widget/entry/presenter.js"
  );
}

export function getDefaults() {
  return {
    avatarId: process.env.DEMO_DEFAULT_AVATAR_ID || "",
    sceneId: process.env.DEMO_DEFAULT_SCENE_ID || "",
    voiceId: process.env.DEMO_DEFAULT_VOICE_ID || "",
  };
}

function baseUrl(): string {
  return requireEnv("PERXONA_API_BASE_URL").replace(/\/$/, "");
}

async function callUpstream(
  path: string,
  opts: RequestInit = {},
  token?: string,
): Promise<Response> {
  const headers = new Headers(opts.headers);
  if (!headers.has("Content-Type") && opts.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${baseUrl()}${path}`, { ...opts, headers });
}

async function upstreamJson<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const err: UpstreamError = Object.assign(
      new Error(`upstream ${label} failed`),
      { status: response.status, payload },
    );
    throw err;
  }
  return response.json() as Promise<T>;
}

async function login(): Promise<string> {
  const email = requireEnv("PERXONA_CONNECT_EMAIL");
  const password = requireEnv("PERXONA_CONNECT_PASSWORD");
  const response = await callUpstream("/api/v1/connect/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await upstreamJson<{ access_token: string }>(response, "login");
  return data.access_token;
}

type GlobalConnect = {
  cachedToken: string | null;
  loginPromise: Promise<string> | null;
};

const globalForConnect = globalThis as typeof globalThis & {
  __perxonaConnect?: GlobalConnect;
};

function state(): GlobalConnect {
  if (!globalForConnect.__perxonaConnect) {
    globalForConnect.__perxonaConnect = {
      cachedToken: null,
      loginPromise: null,
    };
  }
  return globalForConnect.__perxonaConnect;
}

async function getToken({ forceRefresh = false } = {}): Promise<string> {
  const s = state();
  if (s.cachedToken && !forceRefresh) return s.cachedToken;
  if (forceRefresh) s.cachedToken = null;
  if (!s.loginPromise) {
    s.loginPromise = login()
      .then((token) => {
        s.cachedToken = token;
        return token;
      })
      .finally(() => {
        s.loginPromise = null;
      });
  }
  return s.loginPromise;
}

export async function authedCall<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = await getToken();
  try {
    return await fn(token);
  } catch (err) {
    const status = (err as UpstreamError).status;
    if (status !== 401 && status !== 403) throw err;
    const fresh = await getToken({ forceRefresh: true });
    return fn(fresh);
  }
}

export async function mintConnectToken(): Promise<string> {
  return authedCall(async (token) => {
    await listVoices(token);
    return token;
  });
}

async function listVoices(token: string): Promise<CatalogPage> {
  const response = await callUpstream("/api/v1/connect/voices", {}, token);
  return upstreamJson(response, "voices");
}

export async function fetchVoices(): Promise<CatalogPage> {
  return authedCall((token) => listVoices(token));
}

export async function fetchAvatars(): Promise<CatalogPage> {
  return authedCall(async (token) => {
    const response = await callUpstream(
      "/api/v1/connect/assets/avatars",
      {},
      token,
    );
    const page = await upstreamJson<CatalogPage & { items?: Array<Record<string, unknown>> }>(
      response,
      "avatars",
    );
    return {
      ...page,
      items: (page.items ?? []).map(({ avatar_id, ...rest }) => ({
        id: String(avatar_id),
        ...rest,
      })),
    };
  });
}

export async function fetchScenes(): Promise<CatalogPage> {
  return authedCall(async (token) => {
    const response = await callUpstream(
      "/api/v1/connect/assets/scenes",
      {},
      token,
    );
    const page = await upstreamJson<CatalogPage & { items?: Array<Record<string, unknown>> }>(
      response,
      "scenes",
    );
    return {
      ...page,
      items: (page.items ?? []).map(({ scene_id, ...rest }) => ({
        id: String(scene_id),
        ...rest,
      })),
    };
  });
}

export function toErrorResponse(err: unknown): Response {
  const e = err as UpstreamError;
  const status = typeof e.status === "number" ? e.status : 502;
  const body =
    e.payload && typeof e.payload === "object"
      ? e.payload
      : { error: e.message || String(err) };
  return Response.json(body, { status });
}
