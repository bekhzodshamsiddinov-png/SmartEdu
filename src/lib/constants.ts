import type { LeadStage, StudentStatus } from '@/db/schema';
import type { Tone } from '@/components/ui';

export const LEAD_STAGES: { key: LeadStage; label: string; tone: Tone }[] = [
  { key: 'yangi', label: 'Yangi', tone: 'info' },
  { key: 'boglanildi', label: "Bog'lanildi", tone: 'neutral' },
  { key: 'sinov_yozildi', label: 'Sinov darsiga yozildi', tone: 'warn' },
  { key: 'sinov_keldi', label: 'Sinov darsiga keldi', tone: 'brand' },
  { key: 'tolov_qildi', label: "To'lov qildi", tone: 'good' },
  { key: 'rad_etdi', label: 'Rad etdi', tone: 'bad' },
];
export const STAGE_INDEX: Record<LeadStage, number> = {
  yangi: 0, boglanildi: 1, sinov_yozildi: 2, sinov_keldi: 3, tolov_qildi: 4, rad_etdi: -1,
};

export const LEAD_SOURCES = ['Instagram', 'Target', 'Telegram', 'Tavsiya', 'Ofisga keldi', "Qo'ng'iroq", 'Maktab', 'Bitiruvchi', 'Boshqa'];

export const STUDENT_STATUS: Record<StudentStatus, { label: string; tone: Tone }> = {
  faol: { label: 'Faol', tone: 'good' },
  xavf: { label: 'Xavf ostida', tone: 'warn' },
  muzlatilgan: { label: 'Muzlatilgan', tone: 'info' },
  ketgan: { label: 'Ketgan', tone: 'bad' },
  bitirgan: { label: 'Bitirgan', tone: 'brand' },
};

export const LEAVE_REASONS = [
  { code: 1, label: 'Moliyaviy qiyinchilik', fix: "Bo'lib to'lash yoki vaqtincha to'xtatish taklifi" },
  { code: 2, label: 'Darsni tushunmayapti', fix: 'Support teacher bilan bepul qo\'shimcha dars' },
  { code: 3, label: "O'qituvchi yoqmadi", fix: "Boshqa guruhga o'tkazish" },
  { code: 4, label: "Vaqt to'g'ri kelmadi", fix: 'Boshqa vaqtdagi guruh' },
  { code: 5, label: "Qiziqishi yo'qoldi", fix: "Rahbar yoki o'qituvchi bilan suhbat" },
  { code: 6, label: "Ko'chib ketdi / maktab yuklamasi", fix: 'Onlayn variant taklifi' },
  { code: 7, label: "Boshqa markazga o'tdi", fix: 'Sababini aniq yozish' },
  { code: 8, label: 'Boshqa sabab', fix: '' },
];

export const RETURN_RESULTS = ['Qaytdi', "O'ylab ko'radi", 'Rad etdi', "Bog'lanib bo'lmadi"];

export const PAY_METHODS: { key: 'naqd' | 'click' | 'payme' | 'karta' | 'bank'; label: string }[] = [
  { key: 'naqd', label: 'Naqd' },
  { key: 'click', label: 'Click' },
  { key: 'payme', label: 'Payme' },
  { key: 'karta', label: 'Karta (terminal)' },
  { key: 'bank', label: "Bank o'tkazmasi" },
];
export const PAY_METHOD_LABEL: Record<string, string> = Object.fromEntries(PAY_METHODS.map((m) => [m.key, m.label]));

export const RESULT_TYPES = ['Olimpiada', 'Birinchi zakaz', 'Ishga kirdi', 'Portfolio proyekt', 'Sertifikat', 'Tanlov', 'Boshqa'];

export const ATT_LABEL: Record<string, { label: string; tone: Tone; short: string }> = {
  keldi: { label: 'Keldi', tone: 'good', short: 'K' },
  kechikdi: { label: 'Kechikdi', tone: 'warn', short: 'Kch' },
  kelmadi: { label: 'Kelmadi', tone: 'bad', short: 'Y' },
  sababli: { label: 'Sababli', tone: 'info', short: 'S' },
};

export const NOTE_KINDS: Record<string, string> = {
  izoh: 'Izoh',
  qongiroq: "Qo'ng'iroq",
  ota_ona: 'Ota-onaga hisobot',
  uchrashuv: 'Uchrashuv',
};

export const COURSE_STATUS: Record<string, { label: string; tone: Tone }> = {
  qoralama: { label: 'Qoralama', tone: 'neutral' },
  sotuvda: { label: 'Sotuvda', tone: 'good' },
  yopiq: { label: 'Yopiq', tone: 'bad' },
};
export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  kutilmoqda: { label: "To'lov kutilmoqda", tone: 'warn' },
  tolandi: { label: "To'landi", tone: 'good' },
  qaytarildi: { label: 'Qaytarildi', tone: 'bad' },
  bekor: { label: 'Bekor qilingan', tone: 'neutral' },
};
export const LEVELS: Record<string, string> = { boshlangich: "Boshlang'ich", orta: "O'rta", yuqori: 'Yuqori' };
export const LESSON_KINDS: Record<string, string> = { video: 'Video dars', matn: 'Matnli dars', test: 'Test', topshiriq: 'Amaliy topshiriq' };
export const ORDER_METHODS: Record<string, string> = { click: 'Click', payme: 'Payme', uzum: 'Uzum', karta: 'Karta', naqd: 'Naqd', bank: "Bank o'tkazmasi" };
