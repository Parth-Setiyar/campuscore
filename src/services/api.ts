export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// Keep JWT token strictly in JS memory (never in localStorage or sessionStorage)
let inMemoryToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export function registerSessionExpiredHandler(handler: () => void): void {
  sessionExpiredHandler = handler;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    skipAuth?: boolean;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!options.skipAuth && inMemoryToken) {
    headers.Authorization = `Bearer ${inMemoryToken}`;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Network connection error. Please check your connection and retry.', 0, 'NETWORK_ERROR');
  }

  let data: Record<string, unknown> = {};
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !options.skipAuth && inMemoryToken) {
      inMemoryToken = null;
      sessionExpiredHandler?.();
    }
    throw new ApiError(
      typeof data.error === 'string' ? data.error : `Request failed with status ${response.status}`,
      response.status,
      typeof data.code === 'string' ? data.code : undefined,
      data
    );
  }

  return data as T;
}
