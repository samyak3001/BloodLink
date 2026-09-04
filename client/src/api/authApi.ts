import {
  AuthResponse,
  LoginCredentials,
  RegisterData,
  ForgotPasswordData,
  ResetPasswordData,
} from '../types';

const TOKEN_KEY = 'bloodlink_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Custom fetch wrapper that automatically appends Bearer token if present
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(endpoint, {
    ...options,
    headers,
  });
}

/**
 * Register user API call
 */
export async function registerApi(data: RegisterData): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const json = await res.json();
  if (!res.ok) {
    // Surface field-level validation errors from the backend (e.g. Zod superRefine errors)
    const fieldErrors = Array.isArray(json.errors)
      ? json.errors.map((e: { field: string; message: string }) => e.message).join(' | ')
      : null;
    throw new Error(fieldErrors || json.message || 'Registration failed');
  }
  return json;
}

/**
 * Login API call
 */
export async function loginApi(credentials: LoginCredentials): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  const json = await res.json();
  if (!res.ok) {
    const fieldErrors = Array.isArray(json.errors)
      ? json.errors.map((e: { field: string; message: string }) => e.message).join(' | ')
      : null;
    throw new Error(fieldErrors || json.message || 'Login failed');
  }
  return json;
}

/**
 * Fetch authenticated profile
 */
export async function getMeApi(): Promise<AuthResponse> {
  const res = await authenticatedFetch('/api/auth/me');
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Session expired or invalid');
  }
  return json;
}

/**
 * Request password recovery instructions
 */
export async function forgotPasswordApi(
  data: ForgotPasswordData
): Promise<{ message: string; devResetToken?: string }> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to request password reset');
  }
  return json;
}

/**
 * Reset password with token
 */
export async function resetPasswordApi(
  data: ResetPasswordData
): Promise<{ message: string }> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Password reset failed');
  }
  return json;
}
