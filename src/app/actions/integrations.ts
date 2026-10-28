'use server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { assertSection } from '@/lib/auth';
import { run, str, int } from '@/lib/action';
import { audit, clientIp, overLimit } from '@/lib/security';
import { exchangeAndListPages, fetchForms, GraphError, loadMeta, newVerifyToken, saveMeta, subscribePage, syncRecent } from '@/lib/meta';

/** Integratsiyalarni faqat rahbar boshqaradi; har bir o'zgarish xavfsizlik jurnaliga yoziladi */
async function boss() {
  const u = await assertSection('settings');
  if (u.role !== 'rahbar') throw new Error('Integratsiyalarni faqat rahbar boshqaradi.');
  if (await overLimit('integration', String(u.id), 30, 10)) throw new Error("Juda ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring.");
  return u;
}

const graphMsg = (e: unknown) => {
  if (e instanceof GraphError) return e.message;
  throw e;
};

/** 1-qadam: App ID, App Secret va Graph API Explorer'dan olingan foydalanuvchi tokeni → sahifalar ro'yxati */
export async function metaConnect(fd: FormData) {
  return run(async () => {
    const u = await boss();
    const appId = str(fd, 'appId') ?? '';
    const appSecret = str(fd, 'appSecret') ?? '';
    const userToken = str(fd, 'userToken') ?? '';
    if (!/^\d{6,25}$/.test(appId)) throw new Error("App ID faqat raqamlardan iborat bo'ladi (Meta → App settings → Basic).");
    if (!/^[0-9a-f]{32}$/i.test(appSecret)) throw new Error("App Secret 32 belgili bo'ladi (Meta → App settings → Basic → Show).");
    if (userToken.length < 40 || userToken.length > 1000 || /\s/.test(userToken)) throw new Error("Foydalanuvchi tokenini to'liq nusxalang (Graph API Explorer → Generate Access Token).");
    let pages;
    try {
      pages = await exchangeAndListPages(appId, appSecret, userToken);
    } catch (e) {
      throw new Error(graphMsg(e));
    }
    if (!pages.length) throw new Error("Bu akkauntda Facebook sahifa topilmadi. Instagram akkaunt Facebook sahifaga ulangan bo'lishi kerak.");
    const cur = await loadMeta();
    await saveMeta({ secret: { appSecret, pageToken: cur.secret?.appSecret === appSecret ? cur.secret?.pageToken : undefined, pendingPages: pages }, info: { appId, verifyToken: cur.info.verifyToken ?? newVerifyToken() } }, u.id);
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Meta: ulanish boshlandi', detail: `App ${appId}, ${pages.length} sahifa`, ip: await clientIp() });
    return { message: `${pages.length} ta sahifa topildi — lidlar keladigan sahifani tanlang` };
  });
}

/** 2-qadam: sahifani tanlash → sahifa tokeni saqlanadi, ilova sahifa lidlariga obuna qilinadi, formalar yuklanadi */
export async function metaSelectPage(pageId: string) {
  return run(async () => {
    const u = await boss();
    const { secret } = await loadMeta();
    const p = secret?.pendingPages?.find((x) => x.id === pageId);
    if (!secret?.appSecret || !p) throw new Error("Avval 1-qadamni bajaring.");
    let forms: Awaited<ReturnType<typeof fetchForms>> = [];
    let subscribed = true;
    let warn: string | null = null;
    try {
      await subscribePage(p.id, p.token, secret.appSecret);
    } catch (e) {
      subscribed = false;
      warn = graphMsg(e);
    }
    try {
      forms = await fetchForms(p.id, p.token, secret.appSecret);
    } catch (e) {
      warn = warn ?? graphMsg(e);
    }
    await saveMeta(
      {
        secret: { appSecret: secret.appSecret, pageToken: p.token },
        info: { pageId: p.id, pageName: p.name, igName: p.ig, subscribed, forms: forms.map((f) => ({ ...f, branchId: null, courseId: null })), connectedAt: new Date().toISOString(), lastError: warn },
      },
      u.id,
    );
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: 'Meta: sahifa ulandi', detail: `${p.name}${p.ig ? ` (@${p.ig})` : ''}`, ip: await clientIp() });
    return { message: warn ? `Sahifa ulandi, lekin: ${warn}` : `${p.name} ulandi. ${forms.length} ta forma topildi.` };
  });
}

/** Forma → filial va yo'nalish (bu formadan kelgan lid avtomatik shu filial/kursga tushadi) */
export async function metaSaveForm(formId: string, fd: FormData) {
  return run(async () => {
    const u = await boss();
    const { info } = await loadMeta();
    const forms = info.forms ?? [];
    const f = forms.find((x) => x.id === formId);
    if (!f) throw new Error('Forma topilmadi.');
    const branchId = int(fd, 'branchId');
    const courseId = int(fd, 'courseId');
    if (branchId) {
      const [b] = await db.execute(sql`select 1 from branches where id = ${branchId}`);
      if (!b) throw new Error("Filial noto'g'ri.");
    }
    if (courseId) {
      const [c] = await db.execute(sql`select 1 from courses where id = ${courseId}`);
      if (!c) throw new Error("Yo'nalish noto'g'ri.");
    }
    await saveMeta({ info: { forms: forms.map((x) => (x.id === formId ? { ...x, branchId, courseId } : x)) } }, u.id);
    return { message: 'Forma sozlandi' };
  });
}

/** Hozir tekshirish: formalarni yangilaydi va oxirgi 7 kun lidlarini tortib oladi (o'tkazib yuborilganlar ham tushadi) */
export async function metaSyncNow() {
  return run(async () => {
    await boss();
    const { secret, info } = await loadMeta();
    if (!secret?.pageToken || !info.pageId) throw new Error('Avval sahifani ulang.');
    const r = await syncRecent(24 * 7);
    const after = await loadMeta();
    if (after.info.lastError) throw new Error(after.info.lastError);
    return { message: r.added ? `${r.added} ta yangi lid topildi, ${r.processed} tasi CRM ga yozildi` : "Hammasi joyida — yangi lid yo'q" };
  });
}

export async function metaRotateVerifyToken() {
  return run(async () => {
    const u = await boss();
    await saveMeta({ info: { verifyToken: newVerifyToken() } }, u.id);
    return { message: "Yangi tasdiqlash tokeni yaratildi — uni Meta Webhooks sozlamasiga ham qo'ying" };
  });
}

export async function metaDisconnect() {
  return run(async () => {
    const u = await boss();
    await db.execute(sql`delete from integrations where key = 'meta'`);
    await audit({ actorType: 'xodim', actorId: u.id, actorName: u.fullName, action: "Meta: ulanish o'chirildi", ip: await clientIp() });
    return { message: "Meta ulanishi o'chirildi. Kelgan lidlar CRM da qoladi." };
  });
}

/** Xato bo'lib qolgan lidni qayta urinish */
export async function metaRetry(id: number) {
  return run(async () => {
    await boss();
    await db.execute(sql`update meta_leads set status = 'kutilmoqda', attempts = 0, error = null where id = ${id} and status = 'xato'`);
    const { processPending } = await import('@/lib/meta');
    await processPending(5);
    return { message: 'Qayta urinildi' };
  });
}
