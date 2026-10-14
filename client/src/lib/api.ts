/**
 * Single HTTP entry point for the app.
 *
 * `api` / `post` / `put` / `patch` / `del` / `postForm` intentionally match the
 * signatures used by the pages this template is meant to host, so a page can be
 * copied in without rewriting its `@/lib/api` imports.
 */

/** Shape every Express route in this template responds with. */
export interface ApiEnvelope<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly payload: unknown;

  constructor(message: string, status: number, payload?: unknown, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.code = code;
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const TOKEN_STORAGE_KEY = "token";

export const getToken = (): string | null => localStorage.getItem(TOKEN_STORAGE_KEY);
export const storeToken = (token: string): void => localStorage.setItem(TOKEN_STORAGE_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_STORAGE_KEY);

let unauthorizedHandler: (() => void) | null = null;

/**
 * AuthContext registers here so a token that expires mid-session surfaces the
 * re-login prompt no matter which module issued the request.
 */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export interface RequestOptions {
  /** Pass `false` to swallow a 401 instead of prompting, e.g. the boot-time session check. */
  promptOnUnauthorized?: boolean;
}

/** Raw response escape hatch, for callers that need status codes or streams. */
export async function request(
  path: string,
  init?: RequestInit,
  options: RequestOptions = {},
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  // Only prompt when the caller actually had a token; guests hitting a
  // protected route are expected to get a 401.
  if (response.status === 401 && token && options.promptOnUnauthorized !== false) {
    unauthorizedHandler?.();
  }

  return response;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;

  if ((response.headers.get("content-type") ?? "").includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

/**
 * Parses a response into an envelope without throwing on a non-2xx status, for
 * callers that want to render the server's own error payload. A proxy error or
 * HTML page becomes an envelope describing the status instead of a parse error.
 */
export async function readEnvelope<E extends ApiEnvelope = ApiEnvelope>(
  response: Response,
): Promise<E> {
  const body = await readBody(response);

  if (body && typeof body === "object") return body as E;

  return {
    success: false,
    message: `Server returned ${response.status} ${response.statusText}`.trim(),
    ...(typeof body === "string" && body ? { error: body } : {}),
  } as E;
}

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await request(path, init);
  const body = await readBody(response);

  if (!response.ok) {
    const envelope = (typeof body === "object" ? body : null) as ApiEnvelope | null;
    throw new ApiError(
      envelope?.message ?? `Request to ${path} failed with status ${response.status}`,
      response.status,
      body,
      envelope?.code,
    );
  }

  return body as T;
}

const jsonBody = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const post = <T = any>(path: string, body: unknown): Promise<T> =>
  api<T>(path, { method: "POST", ...jsonBody(body) });

export const put = <T = any>(path: string, body: unknown): Promise<T> =>
  api<T>(path, { method: "PUT", ...jsonBody(body) });

export const patch = <T = any>(path: string, body: unknown): Promise<T> =>
  api<T>(path, { method: "PATCH", ...jsonBody(body) });

export const del = <T = any>(path: string): Promise<T> => api<T>(path, { method: "DELETE" });

/** Multipart upload; the browser sets the boundary, so no Content-Type here. */
export const postForm = <T = any>(path: string, body: FormData): Promise<T> =>
  api<T>(path, { method: "POST", body });

/** Collapses `{ success, data }` down to `data`, throwing on `success: false`. */
export function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (!envelope.success) {
    throw new ApiError(envelope.message ?? "Request failed", 0, envelope, envelope.code);
  }
  return envelope.data as T;
}

/** Best-effort message for anything thrown by the helpers above. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return String(error);
}
