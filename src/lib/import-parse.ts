/**
 * Excel jadvallarini (o'quvchilar ro'yxati, lidlar ro'yxati) tushunish: ustunlarni sarlavhasidan aniqlaydi.
 * Brauzerda ham, serverda ham ishlaydi (hech qanday bog'liqliksiz).
 */

export type Cell = string | number | boolean | Date | null | undefined;

export type ParsedRow = {
  /** Excel'dagi qator raqami (foydalanuvchiga ko'rsatish uchun) */
  line: number;
  name: string;
  /** O'quvchining o'z raqami, bo'lmasa ota yoki ona raqami */
  phone: string | null;
  ownPhone: string | null;
  fatherName: string | null;
  fatherPhone: string | null;
  motherName: string | null;
  motherPhone: string | null;
  direction: string | null;
  days: string | null;
  time: string | null;
  group: string | null;
  /** O'qishni boshlagan sana (YYYY-MM-DD) */
  startDate: string | null;
  comment: string | null;
  /** Qolgan barcha to'ldirilgan ustunlar: "Sarlavha: qiymat" */
  extra: { label: string; value: string }[];
};

export type ParsedSheet = { name: string; headers: string[]; rows: ParsedRow[]; kind: 'lead' | 'student'; hasGroupColumn: boolean };

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ʻʼ‘’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

function text(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isoDate(v) ?? '';
  return String(v).replace(/\s+/g, ' ').trim();
}

function isoDate(v: Cell): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // Excel sanalari UTC yarim tunda keladi — sanani o'zgartirmasdan olamiz
    const y = v.getUTCFullYear();
    if (y < 2000 || y > 2100) return null;
    return v.toISOString().slice(0, 10);
  }
  const s = text(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) ?? null;
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (d) return `${d[3]}-${d[2].padStart(2, '0')}-${d[1].padStart(2, '0')}`;
  return null;
}

/** Telefon: 9 xonali yoki 998 bilan 12 xonali bo'lsa — 998XXXXXXXXX, aks holda null */
export function cleanPhone(v: Cell): string | null {
  const d = text(v).replace(/\D/g, '');
  if (d.length === 9) return '998' + d;
  if (d.length === 12 && d.startsWith('998')) return d;
  return null;
}

type Role = 'num' | 'name' | 'phone' | 'father' | 'mother' | 'direction' | 'days' | 'time' | 'group' | 'start' | 'comment' | 'extra';

function roleOf(h: string, prev: Role | null): Role {
  const x = norm(h);
  if (!x) return 'extra';
  if (x === '№' || x === 'n' || x === '#' || x === 't/r') return 'num';
  if (/nomer|telefon|raqam|tel\.?$/.test(x)) return prev === 'father' ? 'father' : prev === 'mother' ? 'mother' : 'phone';
  if (/o'quvchi|oquvchi|ism|f\.?i\.?sh|full ?name|^name$/.test(x)) return 'name';
  if (/^otasi|ota$|father/.test(x)) return 'father';
  if (/^onasi|ona$|mother/.test(x)) return 'mother';
  if (/yo'nalish|yonalish|kurs|direction/.test(x)) return 'direction';
  if (/kun/.test(x)) return 'days';
  if (/vaqt|soat/.test(x) && !/qancha|bo'ldi/.test(x)) return 'time';
  if (/guruh/.test(x)) return 'group';
  if (/boshla/.test(x) && /sana/.test(x)) return 'start';
  if (/izoh|holat|status|natija/.test(x)) return 'comment';
  return 'extra';
}

/** Hafta kunlari: "Dushanba/Chorshanba/Juma" → "Du,Chor,Ju" (guruh formatida) */
export function daysCode(v: string | null): string | null {
  if (!v) return null;
  const x = norm(v);
  // Bosh harflar bo'yicha: "dushanba" ichida "shanba" bor, shuning uchun faqat so'z boshi tekshiriladi
  const map: [string, string][] = [['dush', 'Du'], ['du', 'Du'], ['sesh', 'Se'], ['se', 'Se'], ['chor', 'Chor'], ['pay', 'Pa'], ['jum', 'Ju'], ['ju', 'Ju'], ['shan', 'Sha'], ['sha', 'Sha'], ['yak', 'Ya']];
  const parts = x.split(/[/,;\s-]+/).filter(Boolean);
  const got = new Set<string>();
  for (const p of parts) {
    const hit = map.find(([k]) => (['du', 'se', 'ju', 'sha'].includes(k) ? p.replace(/\.$/, '') === k : p.startsWith(k)));
    if (hit) got.add(hit[1]);
  }
  const order = ['Du', 'Se', 'Chor', 'Pa', 'Ju', 'Sha', 'Ya'];
  const r = order.filter((c) => got.has(c));
  return r.length ? r.join(',') : null;
}

/** "14:00-16:00" → ['14:00','16:00'] */
export function timeRange(v: string | null): [string, string] | null {
  const m = (v ?? '').match(/(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const f = (h: string, mm: string) => `${h.padStart(2, '0')}:${mm}`;
  return [f(m[1], m[2]), f(m[3], m[4])];
}

export function parseSheet(name: string, data: Cell[][]): ParsedSheet | null {
  const hi = data.findIndex((r) => r.some((c) => /o'quvchi|oquvchi|ism/i.test(norm(text(c)))));
  if (hi < 0) return null;
  const headers = data[hi].map((c) => text(c));
  const roles: Role[] = [];
  let prev: Role | null = null;
  headers.forEach((h, i) => {
    const r = roleOf(h, prev);
    roles[i] = r === 'name' && roles.includes('name') ? 'extra' : r;
    if (r !== 'extra') prev = r;
  });
  const rows: ParsedRow[] = [];
  for (let i = hi + 1; i < data.length; i++) {
    const r = data[i] ?? [];
    const row: ParsedRow = {
      line: i + 1, name: '', phone: null, ownPhone: null, fatherName: null, fatherPhone: null, motherName: null, motherPhone: null,
      direction: null, days: null, time: null, group: null, startDate: null, comment: null, extra: [],
    };
    const comments: string[] = [];
    roles.forEach((role, c) => {
      const v = r[c];
      const t = text(v);
      if (!t) return;
      const isPhone = /nomer|telefon|raqam/.test(norm(headers[c]));
      switch (role) {
        case 'name': row.name = t.slice(0, 80); break;
        case 'phone': row.ownPhone ??= cleanPhone(v); break;
        case 'father': if (isPhone) row.fatherPhone ??= cleanPhone(v); else row.fatherName ??= t.slice(0, 60); break;
        case 'mother': if (isPhone) row.motherPhone ??= cleanPhone(v); else row.motherName ??= t.slice(0, 60); break;
        case 'direction': row.direction ??= t.slice(0, 60); break;
        case 'days': row.days ??= t.slice(0, 60); break;
        case 'time': if (t !== '-') row.time ??= t.slice(0, 30); break;
        case 'group': row.group ??= t.slice(0, 40); break;
        case 'start': {
          const d = isoDate(v);
          // Sana ustuniga yozilgan matn (masalan, qo'ng'iroq natijasi) — izohga qo'shiladi
          if (d) row.startDate ??= d;
          else comments.push(t);
          break;
        }
        case 'comment': comments.unshift(t); break;
        case 'extra': if (headers[c]) row.extra.push({ label: headers[c], value: t.slice(0, 400) }); else comments.push(t); break;
      }
    });
    if (!row.name || row.name.length < 2) continue;
    row.comment = comments.join('. ').slice(0, 300) || null;
    row.phone = row.ownPhone ?? row.motherPhone ?? row.fatherPhone;
    rows.push(row);
  }
  const looksLead = /lid|lead/i.test(name);
  return { name: name.trim(), headers, rows, kind: looksLead ? 'lead' : 'student', hasGroupColumn: roles.includes('group') };
}

export type LeadGuess = { stage: 'yangi' | 'boglanildi'; callStatus: string | null };

/** Izohdan lid bosqichini taxmin qilish: "keladi" → qiziqdi, "gaplashadi" → o'ylab ko'radi, "ko'tarmadi" → javob bermadi */
export function guessLead(comment: string | null): LeadGuess {
  const x = norm(comment ?? '');
  if (!x) return { stage: 'yangi', callStatus: null };
  if (/ko'?tar|javob ber|o'?chiq|ochiq emas/.test(x)) return { stage: 'yangi', callStatus: 'javob_bermadi' };
  if (/kelad|kelall|kelish|keladi/.test(x)) return { stage: 'boglanildi', callStatus: 'qiziqdi' };
  if (/gaplash|o'?ylab/.test(x)) return { stage: 'boglanildi', callStatus: 'oylab_koradi' };
  if (/yangi yil|qaytad|keyin|musobaqa|safar/.test(x)) return { stage: 'boglanildi', callStatus: 'qayta_qongiroq' };
  return { stage: 'yangi', callStatus: null };
}

/** Lid yoki o'quvchi kartasiga yoziladigan to'liq izoh */
export function describe(r: ParsedRow, sheet: string) {
  const lines = [
    `Excel ro'yxatidan («${sheet}», ${r.line}-qator)`,
    r.direction && `Yo'nalish: ${r.direction}`,
    r.comment && `Izoh: ${r.comment}`,
    r.group && `Guruh: ${r.group}`,
    (r.days || r.time) && `Dars vaqti: ${[r.days, r.time].filter(Boolean).join(', ')}`,
    r.startDate && `O'qishni boshlagan: ${r.startDate}`,
    ...r.extra.map((e) => `${e.label}: ${e.value}`),
    (r.fatherName || r.fatherPhone) && `Otasi: ${[r.fatherName, r.fatherPhone && '+' + r.fatherPhone].filter(Boolean).join(', ')}`,
    (r.motherName || r.motherPhone) && `Onasi: ${[r.motherName, r.motherPhone && '+' + r.motherPhone].filter(Boolean).join(', ')}`,
    r.ownPhone && r.phone !== r.ownPhone && `O'quvchi raqami: +${r.ownPhone}`,
  ].filter(Boolean) as string[];
  return lines.join('\n');
}

/** Lid kartasidagi qisqa izoh (bir qator) */
export function shortNote(r: ParsedRow) {
  const dur = r.extra.find((e) => /qancha muddat|nech oy|necha oy/i.test(norm(e.label)))?.value;
  const reached = r.extra.find((e) => /yetib kel/i.test(norm(e.label)))?.value;
  return [
    r.comment,
    dur && `avval ${dur} o'qigan`,
    reached && `to'xtagan joyi: ${reached}`,
    (r.days || r.time) && `vaqti: ${[r.days, r.time].filter(Boolean).join(' ')}`,
  ]
    .filter(Boolean)
    .join('; ')
    .slice(0, 500);
}
