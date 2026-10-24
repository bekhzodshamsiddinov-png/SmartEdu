import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'smartedu_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 kun

function secret() {
  const s = process.env.AUTH_SECRET || 'smartedu-dev-secret-change-me-please-0123456789';
  return new TextEncoder().encode(s);
}

export type SessionPayload = { uid: number; role: string };

export async function signSession(p: SessionPayload) {
  return new SignJWT(p)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== 'number') return null;
    return { uid: payload.uid, role: String(payload.role) };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: MAX_AGE,
};
