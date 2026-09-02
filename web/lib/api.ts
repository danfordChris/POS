// Low-level client for the POS edge (Kong). No auth/refresh logic here — callers
// pass a bearer token; `lib/session.ts` and the route handlers own the cookies.

export const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8000';

export interface ApiErrorShape {
  code: string;
  message: string;
  devMessage?: string;
  details?: { field: string; issue: string }[];
  status: number;
}

/** Thrown for any non-2xx response. Carries the `{ error }` envelope fields. */
export class ApiError extends Error implements ApiErrorShape {
  code: string;
  devMessage?: string;
  details?: { field: string; issue: string }[];
  status: number;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = 'ApiError';
    this.code = shape.code;
    this.devMessage = shape.devMessage;
    this.details = shape.details;
    this.status = shape.status;
  }
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function apiFetch<T = unknown>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, token, headers = {}, signal } = opts;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      cache: 'no-store',
      signal,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    throw new ApiError({
      code: 'network_error',
      message: 'Could not reach the server. Check your connection and retry.',
      devMessage: cause instanceof Error ? cause.message : String(cause),
      status: 0,
    });
  }

  const text = await res.text();
  const json = text ? safeJson(text) : null;

  if (!res.ok) {
    const err = (json as { error?: Partial<ApiErrorShape> } | null)?.error ?? {};
    throw new ApiError({
      code: err.code ?? 'unknown',
      message: err.message ?? res.statusText ?? 'Request failed',
      devMessage: err.devMessage,
      details: err.details,
      status: res.status,
    });
  }

  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
