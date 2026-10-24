'use server';
import { eq, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { users, settings, type Role } from '@/db/schema';
import { assertSection, getCurrentUser } from '@/lib/auth';
import { run, str, req, int } from '@/lib/action';
import { normalizePhone } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/roles';
import { notifyTelegram } from '@/lib/payments';
import { LOCK_MESSAGE, audit, clearHits, hashPassword, overLimit, passwordProblem, verifyPassword } from '@/lib/security';
import { SESSION_COOKIE, sessionCookieOptions, signSession } from '@/lib/session';
import { hashBackup, newBackupCodes, newSecret, openSecret, otpauthUrl, sealSecret, verifyTotp } from '@/lib/totp';

export async function saveStaff(id: number | null, fd: FormData) {
  return run(async () => {
    const me = await assertSection('staff');
    const role = req(fd, 'role', 'Lavozim') as Role;
    if (!(role in ROLE_LABELS)) throw new Error("Lavozim noto'g'ri.");
    const v = {
      fullName: req(fd, 'fullName', 'Ism-familiya'),
      phone: normalizePhone(req(fd, 'phone', 'Telefon')),
      role,
      position: str(fd, 'position'),
      baseSalary: int(fd, 'baseSalary') ?? 0,
      bonusRule: str(fd, 'bonusRule'),
      hiredAt: str(fd, 'hiredAt'),
      branchId: role === 'rahbar' ? null : int(fd, 'branchId'),
    };
    const pw = str(fd, 'password');
    if (pw) {
      const err = passwordProblem(pw, v.phone);
      if (err) throw new Error(err);
    }
    if (id) {
      const [old] = await db.select().from(users).where(eq(users.id, id));
      if (!old) throw new Error('Xodim topilmadi.');
      if (old.id === me.id && role !== 'rahbar') throw new Error("O'zingizning rahbar lavozimingizni o'zgartira olmaysiz.");
      // Parol, lavozim, filial yoki telefon o'zgarsa — xodimning barcha ochiq sessiyalari yopiladi
      const revoke = !!pw || old.role !== role || old.branchId !== v.branchId || old.phone !== v.phone;
      await db
        .update(users)
        .set({ ...v, ...(pw ? { passwordHash: await hashPassword(pw) } : {}), ...(revoke ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}) })
        .where(eq(users.id, id));
      await audit({
        actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: 'Xodim tahrirlandi',
        detail: `${old.fullName}${old.role !== role ? `: lavozim ${old.role} → ${role}` : ''}${pw ? ', parol yangilandi' : ''}`,
      });
      return { message: "Xodim ma'lumotlari yangilandi" };
    }
    if (!pw) throw new Error('Yangi xodim uchun parol kiriting.');
    await db.insert(users).values({ ...v, passwordHash: await hashPassword(pw) });
    await audit({ actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: "Xodim qo'shildi", detail: `${v.fullName} (${role})` });
    return { message: "Xodim qo'shildi" };
  });
}

export async function toggleStaff(id: number) {
  return run(async () => {
    const me = await assertSection('staff');
    if (me.id === id) throw new Error("O'zingizni o'chira olmaysiz.");
    const [u] = await db.select().from(users).where(eq(users.id, id));
    if (!u) throw new Error('Xodim topilmadi.');
    await db.update(users).set({ active: !u.active, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, id));
    await audit({ actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: u.active ? 'Xodim faolsizlantirildi' : 'Xodim faollashtirildi', detail: u.fullName });
    return { message: u.active ? 'Xodim faolsizlantirildi' : 'Xodim qayta faollashtirildi' };
  });
}

export async function changeMyPassword(fd: FormData) {
  return run(async () => {
    const me = await getCurrentUser();
    if (!me) throw new Error('Tizimga qayta kiring.');
    const [u] = await db.select().from(users).where(eq(users.id, me.id));
    if (await overLimit('staff-pw', `u:${me.id}`, 5, 15)) throw new Error(LOCK_MESSAGE);
    if (!(await verifyPassword(req(fd, 'current', 'Joriy parol'), u.passwordHash))) throw new Error("Joriy parol noto'g'ri.");
    await clearHits('staff-pw', `u:${me.id}`);
    const next = req(fd, 'next', 'Yangi parol');
    const err = passwordProblem(next, u.phone);
    if (err) throw new Error(err);
    const [r] = await db
      .update(users)
      .set({ passwordHash: await hashPassword(next), sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, me.id))
      .returning({ v: users.sessionVersion });
    // Boshqa qurilmalardagi sessiyalar yopiladi, joriy qurilma qoladi
    (await cookies()).set(SESSION_COOKIE, await signSession({ uid: u.id, role: u.role, v: r.v }), sessionCookieOptions);
    await audit({ actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: "Parolini o'zgartirdi" });
    return { message: "Parol o'zgartirildi. Boshqa qurilmalardan chiqildi." };
  });
}

/** Barcha qurilmalardan chiqish (telefon yo'qolsa) */
export async function logoutEverywhere() {
  return run(async () => {
    const me = await getCurrentUser();
    if (!me) throw new Error('Tizimga qayta kiring.');
    const [r] = await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, me.id)).returning({ v: users.sessionVersion });
    (await cookies()).set(SESSION_COOKIE, await signSession({ uid: me.id, role: me.role, v: r.v }), sessionCookieOptions);
    await audit({ actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: 'Barcha qurilmalardan chiqdi' });
    return { message: 'Boshqa barcha qurilmalardan chiqildi' };
  });
}

export async function saveSettings(fd: FormData) {
  return run(async () => {
    await assertSection('settings');
    const v = {
      centerName: req(fd, 'centerName', 'Markaz nomi'),
      phone: str(fd, 'phone'),
      address: str(fd, 'address'),
      paymentDueDay: Math.min(28, Math.max(1, int(fd, 'paymentDueDay') ?? 5)),
      salaryDay: Math.min(28, Math.max(1, int(fd, 'salaryDay') ?? 10)),
      reservePercent: Math.min(50, Math.max(0, int(fd, 'reservePercent') ?? 10)),
      updatedAt: new Date(),
    };
    await db.insert(settings).values({ id: 1, ...v }).onConflictDoUpdate({ target: settings.id, set: v });
    const me = await getCurrentUser();
    await audit({ actorType: 'xodim', actorId: me?.id, actorName: me?.fullName, action: 'Sozlamalar saqlandi' });
    return { message: 'Sozlamalar saqlandi' };
  });
}

export async function saveAcademySettings(fd: FormData) {
  return run(async () => {
    const me = await assertSection('settings');
    const card = (str(fd, 'payCard') ?? '').replace(/\D/g, '');
    if (card && card.length !== 16) throw new Error("Karta raqami 16 ta raqamdan iborat bo'lsin.");
    const handle = (raw: string | null, re: RegExp) => {
      if (!raw) return null;
      const h = raw.replace(re, '').replace(/^@/, '').replace(/\/$/, '');
      if (!/^[A-Za-z0-9_.]{2,64}$/.test(h)) throw new Error("Telegram/Instagram nomida faqat harf, raqam, _ va . bo'lsin.");
      return h;
    };
    const v = {
      payCard: card || null,
      payCardHolder: str(fd, 'payCardHolder')?.slice(0, 80) ?? null,
      telegram: handle(str(fd, 'telegram'), /^https?:\/\/t\.me\//),
      instagram: handle(str(fd, 'instagram'), /^https?:\/\/(www\.)?instagram\.com\//),
      academyTagline: str(fd, 'academyTagline')?.slice(0, 200) ?? null,
      updatedAt: new Date(),
    };
    const [cur] = await db.select({ payCard: settings.payCard }).from(settings).where(eq(settings.id, 1));
    const cardChanged = (cur?.payCard ?? null) !== v.payCard;
    if (cardChanged) {
      // Pul tushadigan karta — eng nozik joy: o'zgartirish uchun parolni qayta so'raymiz
      if (await overLimit('staff-pw', `u:${me.id}`, 5, 15)) throw new Error(LOCK_MESSAGE);
      const [u] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id));
      if (!(await verifyPassword(str(fd, 'confirmPassword') ?? '', u?.hash))) {
        throw new Error("Karta raqamini o'zgartirish uchun parolingizni to'g'ri kiriting.");
      }
      await clearHits('staff-pw', `u:${me.id}`);
    }
    await db.insert(settings).values({ id: 1, ...v }).onConflictDoUpdate({ target: settings.id, set: v });
    if (cardChanged) {
      const mask = (c: string | null | undefined) => (c ? `**** ${c.slice(-4)}` : "yo'q");
      await audit({ actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: "To'lov kartasi o'zgartirildi", detail: `${mask(cur?.payCard)} → ${mask(v.payCard)}` });
      await notifyTelegram(`⚠️ Akademiya to'lov kartasi o'zgartirildi: ${mask(cur?.payCard)} → ${mask(v.payCard)}\nKim: ${me.fullName}`);
    }
    return { message: 'Akademiya sozlamalari saqlandi' };
  });
}

/* ---------- Ikki bosqichli kirish (2FA) ---------- */

/** 1-qadam: yangi sir yaratib, QR kodni qaytaradi (hali yoqilmaydi) */
export async function start2fa() {
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: 'Tizimga qayta kiring.' };
  const [u] = await db.select({ enabled: users.totpEnabled }).from(users).where(eq(users.id, me.id));
  if (u?.enabled) return { ok: false as const, error: 'Ikki bosqichli kirish allaqachon yoqilgan.' };
  const secret = newSecret();
  await db.update(users).set({ totpSecret: sealSecret(secret), totpLastStep: 0 }).where(eq(users.id, me.id));
  const QR = (await import('qrcode')).default;
  const svg = await QR.toString(otpauthUrl(secret, `+${me.phone}`), { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  return { ok: true as const, secret: secret.replace(/(.{4})/g, '$1 ').trim(), qr: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') };
}

/** 2-qadam: ilovadagi kod to'g'ri bo'lsa yoqiladi va zaxira kodlar beriladi (faqat bir marta ko'rsatiladi) */
export async function confirm2fa(code: string) {
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: 'Tizimga qayta kiring.' };
  if (await overLimit('2fa-setup', `u:${me.id}`, 10, 15)) return { ok: false as const, error: LOCK_MESSAGE };
  const [u] = await db.select().from(users).where(eq(users.id, me.id));
  if (!u?.totpSecret || u.totpEnabled) return { ok: false as const, error: 'Avval QR kodni qayta oling.' };
  const step = verifyTotp(openSecret(u.totpSecret), String(code), 0);
  if (step === null) return { ok: false as const, error: "Kod noto'g'ri. Ilovadagi eng yangi kodni kiriting." };
  const backup = newBackupCodes();
  await db
    .update(users)
    .set({ totpEnabled: true, totpLastStep: step, totpBackup: JSON.stringify(backup.map(hashBackup)), sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, me.id));
  const [r] = await db.select({ v: users.sessionVersion }).from(users).where(eq(users.id, me.id));
  // Boshqa qurilmalardagi eski sessiyalar yopiladi — endi har kirishda kod so'raladi
  (await cookies()).set(SESSION_COOKIE, await signSession({ uid: me.id, role: me.role, v: r.v }), sessionCookieOptions);
  await audit({ actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: '2FA yoqildi' });
  return { ok: true as const, backup };
}

/** O'chirish: parol + ilovadagi kod kerak */
export async function disable2fa(fd: FormData) {
  return run(async () => {
    const me = await getCurrentUser();
    if (!me) throw new Error('Tizimga qayta kiring.');
    if (await overLimit('staff-pw', `u:${me.id}`, 5, 15)) throw new Error(LOCK_MESSAGE);
    const [u] = await db.select().from(users).where(eq(users.id, me.id));
    if (!u?.totpEnabled || !u.totpSecret) throw new Error("Ikki bosqichli kirish yoqilmagan.");
    if (!(await verifyPassword(str(fd, 'password') ?? '', u.passwordHash))) throw new Error("Parol noto'g'ri.");
    if (verifyTotp(openSecret(u.totpSecret), str(fd, 'code') ?? '', u.totpLastStep) === null) throw new Error("Kod noto'g'ri.");
    await db.update(users).set({ totpEnabled: false, totpSecret: null, totpBackup: null, totpLastStep: 0 }).where(eq(users.id, me.id));
    await clearHits('staff-pw', `u:${me.id}`);
    await audit({ actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: "2FA o'chirildi" });
    await notifyTelegram(`⚠️ SmartEdu: ${me.fullName} ikki bosqichli kirishni o'chirdi.`);
    return { message: "Ikki bosqichli kirish o'chirildi" };
  });
}

/** Rahbar: telefonini yo'qotgan xodimning 2FA sini o'chirib beradi */
export async function reset2fa(id: number) {
  return run(async () => {
    const me = await assertSection('staff');
    if (me.id === id) throw new Error("O'zingiznikini \"Mening hisobim\" sahifasida o'chiring.");
    const [u] = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, id));
    if (!u) throw new Error('Xodim topilmadi.');
    await db
      .update(users)
      .set({ totpEnabled: false, totpSecret: null, totpBackup: null, totpLastStep: 0, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, id));
    await audit({ actorType: 'xodim', actorId: me.id, actorName: me.fullName, action: '2FA bekor qilindi', detail: u.fullName });
    return { message: `${u.fullName}: ikki bosqichli kirish o'chirildi` };
  });
}
