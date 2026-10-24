import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'smartedu_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 kun

/** Production'da kuchli AUTH_SECRET bo'lmasa tizim ishlamaydi (soxta sessiya yasab bo'lmasin) */
export function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (s) {
    if (s.length < 32) console.warn('[xavfsizlik] AUTH_SECRET 32 belgidan qisqa — uzunroq kalit qo\'ying');
    return s;
  }
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error("AUTH_SECRET o'rnatilmagan — tizim xavfsiz ishlay olmaydi");
  }
  return 'smartedu-dev-secret-only-for-local-development-0123456789';
}

function secret() {
  return new TextEncoder().encode(authSecret());
}

export type SessionPayload = { uid: number; role: string; v: number };

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
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (typeof payload.uid !== 'number') return null;
    return { uid: payload.uid, role: String(payload.role), v: typeof payload.v === 'number' ? payload.v : 0 };
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
