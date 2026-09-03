/**
 * The one place the app talks to the API.
 *
 * Every call is same-origin (`/api/...`) — the Vite dev server proxies to the
 * Nest app in development, and in production both are served from one origin.
 * That matters: the session is an httpOnly `SameSite=Lax` cookie, so it only
 * travels on same-origin requests and no token is ever readable from JS.
 */

export class ApiError extends Error {
  readonly status: number;
  /** Nest's error payload — carries the zod issues on a 400. */
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  get isAuth(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON body. Mutually exclusive with `form`. */
  body?: unknown;
  /** Multipart body — used by the upload routes. */
  form?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

const BASE = '/api';

function buildUrl(path: string, query: RequestOptions['query']): string {
  const url = `${BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** Nest error bodies are `{ statusCode, message, error }`; message can be an array. */
function messageFrom(payload: unknown, fallback: string): string {
  if (typeof payload === 'string' && payload) return payload;
  if (payload && typeof payload === 'object') {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.length) return message.map(String).join(', ');
  }
  return fallback;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, form, query, signal } = options;

  const init: RequestInit = {
    method,
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  };
  if (form) {
    init.body = form; // let the browser set the multipart boundary
  } else if (body !== undefined) {
    init.headers = { ...init.headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), init);
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new ApiError(0, 'Cannot reach the Veyra API. Check your connection and try again.');
  }

  if (response.status === 204 || response.status === 205) return undefined as T;

  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
  const payload: unknown = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(response.status, messageFrom(payload, response.statusText), payload);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body' | 'form'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body' | 'form'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  upload: <T>(path: string, form: FormData, options?: Omit<RequestOptions, 'method' | 'form'>) =>
    request<T>(path, { ...options, method: 'POST', form }),
};
