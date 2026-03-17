/**
 * Auth helpers for web mode.
 * In Electron mode, auth is not needed (local app).
 */

const IS_WEB = import.meta.env.VITE_MODE === 'web';

export function signInWithGithub() {
  if (!IS_WEB) return;
  window.location.href = '/api/auth/signin/github';
}

export function signInWithGoogle() {
  if (!IS_WEB) return;
  window.location.href = '/api/auth/signin/google';
}

export async function signOut() {
  if (!IS_WEB) return;
  // Try BetterAuth sign-out, then dev-logout for dev cookie
  await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }).catch(() => {});
  await fetch('/api/dev-logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  window.location.reload();
}

export async function getSession(): Promise<{ id: string; email: string; name?: string; avatar?: string } | null> {
  if (!IS_WEB) return null;
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
