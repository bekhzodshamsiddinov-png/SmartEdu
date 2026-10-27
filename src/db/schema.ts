import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  bigint,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const roleEnum = pgEnum('role', [
  'rahbar',
  'admin',
  'oqituvchi',
  'support',
  'sotuv',
  'marketing',
  'bugalter',
]);

export const studentStatusEnum = pgEnum('student_status', ['faol', 'xavf', 'muzlatilgan', 'ketgan', 'bitirgan']);
export const leadStageEnum = pgEnum('lead_stage', [
  'yangi',
  'boglanildi',
  'sinov_yozildi',
  'sinov_keldi',
  'tolov_qildi',
  'rad_etdi',
]);
export const attendanceStatusEnum = pgEnum('attendance_status', ['keldi', 'kelmadi', 'kechikdi', 'sababli']);
export const payMethodEnum = pgEnum('pay_method', ['naqd', 'click', 'payme', 'karta', 'bank']);
export const txTypeEnum = pgEnum('tx_type', ['kirim', 'chiqim']);
export const taskStatusEnum = pgEnum('task_status', ['yangi', 'jarayonda', 'bajarildi']);
export const priorityEnum = pgEnum('priority', ['past', 'orta', 'yuqori']);

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  centerName: text('center_name').notNull().default('United IT Clubs'),
  phone: text('phone'),
  address: text('address'),
  paymentDueDay: integer('payment_due_day').notNull().default(5),
  salaryDay: integer('salary_day').notNull().default(10),
  reservePercent: integer('reserve_percent').notNull().default(10),
  payCard: text('pay_card'),
  payCardHolder: text('pay_card_holder'),
  telegram: text('telegram'),
  instagram: text('instagram'),
  academyTagline: text('academy_tagline'),
  /** Shartnoma matni ({oquvchi}, {kurs}, {narx} va h.k. o'zgaruvchilar bilan) */
  contractTemplate: text('contract_template'),
  /** Coin: har bir kelgan dars uchun va o'z vaqtida to'lov uchun */
  coinsPerLesson: integer('coins_per_lesson').notNull().default(1),
  coinsOnTimePay: integer('coins_on_time_pay').notNull().default(5),
  /** Qarz eslatmasi shu summadan oshganda yuboriladi */
  debtNoticeMin: integer('debt_notice_min').notNull().default(100000),
  /** Ketma-ket necha marta kelmasa administratorga vazifa yaratiladi (0 — o'chiq) */
  absentTaskAfter: integer('absent_task_after').notNull().default(2),
  /** Yangi guruhlar uchun hisob turi: 'oylik' (har oy boshida) yoki 'dars' (har bir dars uchun) */
  billingDefault: text('billing_default').notNull().default('oylik'),
  /** Dars bo'yicha hisobda sababsiz kelmagan dars ham yechiladimi */
  chargeAbsent: boolean('charge_absent').notNull().default(true),
  /** Oylik hisobda o'quvchi oy o'rtasida qo'shilsa, qolgan darslarga mos qisman yechish */
  prorateFirstMonth: boolean('prorate_first_month').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull(),
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  position: text('position'),
  baseSalary: integer('base_salary').notNull().default(0),
  /** O'qituvchi ulushi: o'z guruhlari o'quvchilari to'lagan summadan foiz */
  teacherPercent: integer('teacher_percent').notNull().default(0),
  bonusRule: text('bonus_rule'),
  active: boolean('active').notNull().default(true),
  sessionVersion: integer('session_version').notNull().default(0),
  /** Ikki bosqichli kirish (TOTP) — sir shifrlangan holda saqlanadi */
  totpSecret: text('totp_secret'),
  totpEnabled: boolean('totp_enabled').notNull().default(false),
  totpLastStep: integer('totp_last_step').notNull().default(0),
  /** Zaxira kodlar (sha256 xeshlar, JSON massiv) */
  totpBackup: text('totp_backup'),
  hiredAt: date('hired_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const courses = pgTable('courses', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  monthlyPrice: integer('monthly_price').notNull().default(0),
  durationMonths: integer('duration_months').notNull().default(3),
  color: text('color').notNull().default('#0F766E'),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  courseId: integer('course_id')
    .notNull()
    .references(() => courses.id),
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  teacherId: integer('teacher_id').references(() => users.id),
  supportId: integer('support_id').references(() => users.id),
  days: text('days').notNull().default('Du,Chor,Ju'),
  startTime: text('start_time').notNull().default('14:00'),
  endTime: text('end_time').notNull().default('16:00'),
  room: text('room'),
  capacity: integer('capacity').notNull().default(14),
  /** 'oylik' — har oy uchun to'liq narx; 'dars' — har bir dars uchun (oylik narx / oydagi darslar soni) */
  billing: text('billing').notNull().default('oylik'),
  startDate: date('start_date'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const students = pgTable(
  'students',
  {
    id: serial('id').primaryKey(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    parentName: text('parent_name'),
    parentPhone: text('parent_phone'),
    birthYear: integer('birth_year'),
    birthDate: date('birth_date'),
    school: text('school'),
    address: text('address'),
    source: text('source'),
    status: studentStatusEnum('status').notNull().default('faol'),
    branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    joinedAt: date('joined_at').notNull(),
    leftAt: date('left_at'),
    leftReason: text('left_reason'),
    /** Muzlatilgan bo'lsa — qaytishi kutilgan sana */
    freezeUntil: date('freeze_until'),
    returnAttempt: text('return_attempt'),
    returnResult: text('return_result'),
    graduatedAt: date('graduated_at'),
    note: text('note'),
    leadId: integer('lead_id'),
    /** Ota-ona kabineti havolasining sha256 xeshi (havolaning o'zi saqlanmaydi) */
    cabinetHash: text('cabinet_hash'),
    /** Telegram botga ulangan ota-ona chat id si */
    telegramChatId: text('telegram_chat_id'),
    /** Telegram botga ulanish uchun bir martalik kod */
    telegramLinkCode: text('telegram_link_code'),
    telegramLinkExpires: timestamp('telegram_link_expires', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('students_status_idx').on(t.status), uniqueIndex('students_cabinet_uq').on(t.cabinetHash), uniqueIndex('students_tglink_uq').on(t.telegramLinkCode)],
);

export const enrollments = pgTable(
  'enrollments',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id),
    monthlyFee: integer('monthly_fee').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('enr_student_idx').on(t.studentId), index('enr_group_idx').on(t.groupId)],
);

export const lessons = pgTable(
  'lessons',
  {
    id: serial('id').primaryKey(),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    topic: text('topic'),
    teacherStatus: text('teacher_status').notNull().default('vaqtida'),
    arrivalChecked: boolean('arrival_checked').notNull().default(false),
    note: text('note'),
    markedById: integer('marked_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('lessons_group_date_uq').on(t.groupId, t.date)],
);

export const attendance = pgTable(
  'attendance',
  {
    id: serial('id').primaryKey(),
    groupId: integer('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    status: attendanceStatusEnum('status').notNull(),
    reason: text('reason'),
    reasonId: integer('reason_id'),
    called: boolean('called').notNull().default(false),
    markedById: integer('marked_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('att_uq').on(t.groupId, t.studentId, t.date),
    index('att_date_idx').on(t.date),
    index('att_student_idx').on(t.studentId),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    enrollmentId: integer('enrollment_id').references(() => enrollments.id, { onDelete: 'set null' }),
    branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    amount: integer('amount').notNull(),
    method: payMethodEnum('method').notNull().default('naqd'),
    forMonth: text('for_month'),
    paidAt: date('paid_at').notNull(),
    note: text('note'),
    receivedById: integer('received_by_id').references(() => users.id),
    cashboxId: integer('cashbox_id'),
    /** Bekor qilingan to'lov o'chirilmaydi — belgi bilan saqlanadi */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledById: integer('cancelled_by_id').references(() => users.id),
    cancelReason: text('cancel_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('pay_student_idx').on(t.studentId), index('pay_date_idx').on(t.paidAt)],
);

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    type: txTypeEnum('type').notNull(),
    branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    category: text('category').notNull(),
    amount: integer('amount').notNull(),
    date: date('date').notNull(),
    method: text('method').notNull().default('bank'),
    counterparty: text('counterparty'),
    document: text('document'),
    note: text('note'),
    createdById: integer('created_by_id').references(() => users.id),
    cashboxId: integer('cashbox_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tx_date_idx').on(t.date)],
);

export const reconciliations = pgTable('reconciliations', {
  id: serial('id').primaryKey(),
  month: text('month').notNull().unique(),
  bank: jsonb('bank').$type<Record<string, number>>().notNull().default({}),
  tax: jsonb('tax').$type<Record<string, number>>().notNull().default({}),
  note: text('note'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const leads = pgTable(
  'leads',
  {
    id: serial('id').primaryKey(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    source: text('source').notNull().default('Instagram'),
    branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
    courseId: integer('course_id').references(() => courses.id),
    stage: leadStageEnum('stage').notNull().default('yangi'),
    maxStage: integer('max_stage').notNull().default(0),
    assignedToId: integer('assigned_to_id').references(() => users.id),
    trialDate: date('trial_date'),
    /** Oxirgi qo'ng'iroq natijasi: 'javob_bermadi' | 'qayta_qongiroq' | 'qiziqdi' | 'oylab_koradi' */
    callStatus: text('call_status'),
    /** Keyingi qo'ng'iroq sanasi */
    nextCallAt: date('next_call_at'),
    lostReason: text('lost_reason'),
    note: text('note'),
    studentId: integer('student_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('leads_stage_idx').on(t.stage)],
);

/** Qo'ng'iroqlar, izohlar, ota-onaga yuborilgan hisobotlar */
export const notes = pgTable(
  'notes',
  {
    id: serial('id').primaryKey(),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    kind: text('kind').notNull().default('izoh'),
    text: text('text').notNull(),
    authorId: integer('author_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notes_entity_idx').on(t.entityType, t.entityId), index('notes_kind_idx').on(t.kind)],
);

export const grades = pgTable(
  'grades',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    groupId: integer('group_id').references(() => groups.id, { onDelete: 'set null' }),
    period: text('period').notNull(),
    score: integer('score').notNull(),
    comment: text('comment'),
    teacherId: integer('teacher_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('grades_student_idx').on(t.studentId)],
);

export const results = pgTable(
  'results',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    amount: integer('amount'),
    date: date('date').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('results_student_idx').on(t.studentId)],
);

export const graduates = pgTable('graduates', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id')
    .notNull()
    .unique()
    .references(() => students.id, { onDelete: 'cascade' }),
  workplace: text('workplace'),
  position: text('position'),
  monthlyIncome: integer('monthly_income'),
  freelance: boolean('freelance').notNull().default(false),
  studyingAt: text('studying_at'),
  lastContactAt: date('last_contact_at'),
  referrals: integer('referrals').notNull().default(0),
  inTelegramGroup: boolean('in_telegram_group').notNull().default(false),
  note: text('note'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable(
  'tasks',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    assigneeId: integer('assignee_id').references(() => users.id),
    creatorId: integer('creator_id').references(() => users.id),
    dueDate: date('due_date'),
    status: taskStatusEnum('status').notNull().default('yangi'),
    priority: priorityEnum('priority').notNull().default('orta'),
    /** Tizim yaratgan vazifa kaliti — bir xil vazifa ikki marta yaratilmaydi */
    autoKey: text('auto_key'),
    /** Bog'langan yozuv: 'student' | 'lead' | 'group' */
    entityType: text('entity_type'),
    entityId: integer('entity_id'),
    doneNote: text('done_note'),
    doneAt: timestamp('done_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tasks_assignee_idx').on(t.assigneeId), uniqueIndex('tasks_auto_uq').on(t.autoKey)],
);

/** Xodimlarning kunlik / haftalik hisobotlari */
export const staffReports = pgTable(
  'staff_reports',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    kind: text('kind').notNull().default('kunlik'),
    done: text('done').notNull(),
    problems: text('problems'),
    plan: text('plan'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('reports_user_idx').on(t.userId), index('reports_date_idx').on(t.date)],
);

export type User = typeof users.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type Course = typeof courses.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type LeadStage = (typeof leadStageEnum.enumValues)[number];
export type StudentStatus = (typeof studentStatusEnum.enumValues)[number];

/* ===================== Onlayn kurslar ===================== */

export const onlineCourses = pgTable('online_courses', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  subtitle: text('subtitle'),
  description: text('description'),
  level: text('level').notNull().default('boshlangich'),
  price: integer('price').notNull().default(0),
  oldPrice: integer('old_price'),
  coverUrl: text('cover_url'),
  color: text('color').notNull().default('#008A70'),
  status: text('status').notNull().default('qoralama'),
  category: text('category').notNull().default('ai'),
  outcomes: text('outcomes'),
  audience: text('audience'),
  accessDays: integer('access_days'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const courseModules = pgTable(
  'course_modules',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id')
      .notNull()
      .references(() => onlineCourses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('modules_course_idx').on(t.courseId)],
);

export const courseLessons = pgTable(
  'course_lessons',
  {
    id: serial('id').primaryKey(),
    moduleId: integer('module_id')
      .notNull()
      .references(() => courseModules.id, { onDelete: 'cascade' }),
    courseId: integer('course_id')
      .notNull()
      .references(() => onlineCourses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    kind: text('kind').notNull().default('video'),
    videoUrl: text('video_url'),
    durationMin: integer('duration_min'),
    content: text('content'),
    isFree: boolean('is_free').notNull().default(false),
    published: boolean('published').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('lessons_module_idx').on(t.moduleId), index('lessons_course_idx').on(t.courseId)],
);

export const learners = pgTable('learners', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull().unique(),
  email: text('email'),
  telegram: text('telegram'),
  city: text('city'),
  source: text('source'),
  note: text('note'),
  passwordHash: text('password_hash'),
  sessionVersion: integer('session_version').notNull().default(0),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const promoCodes = pgTable('promo_codes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  percent: integer('percent'),
  amount: integer('amount'),
  courseId: integer('course_id').references(() => onlineCourses.id, { onDelete: 'set null' }),
  maxUses: integer('max_uses'),
  used: integer('used').notNull().default(0),
  validUntil: date('valid_until'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const courseOrders = pgTable(
  'course_orders',
  {
    id: serial('id').primaryKey(),
    learnerId: integer('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    courseId: integer('course_id')
      .notNull()
      .references(() => onlineCourses.id),
    amount: integer('amount').notNull(),
    originalPrice: integer('original_price').notNull(),
    promoCode: text('promo_code'),
    /** Promokod limiti shu buyurtma uchun band qilinganmi */
    promoReserved: boolean('promo_reserved').notNull().default(false),
    method: text('method').notNull().default('click'),
    status: text('status').notNull().default('kutilmoqda'),
    paidAt: date('paid_at'),
    accessUntil: date('access_until'),
    note: text('note'),
    provider: text('provider'),
    providerTx: text('provider_tx'),
    createdById: integer('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('orders_learner_idx').on(t.learnerId), index('orders_course_idx').on(t.courseId), index('orders_paid_idx').on(t.paidAt)],
);

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: serial('id').primaryKey(),
    learnerId: integer('learner_id')
      .notNull()
      .references(() => learners.id, { onDelete: 'cascade' }),
    lessonId: integer('lesson_id')
      .notNull()
      .references(() => courseLessons.id, { onDelete: 'cascade' }),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('progress_uq').on(t.learnerId, t.lessonId)],
);

/** Payme Merchant API tranzaksiyalari */
export const paymeTransactions = pgTable('payme_transactions', {
  id: serial('id').primaryKey(),
  paymeId: text('payme_id').notNull().unique(),
  orderId: integer('order_id')
    .notNull()
    .references(() => courseOrders.id),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  state: integer('state').notNull().default(1),
  reason: integer('reason'),
  paymeTime: bigint('payme_time', { mode: 'number' }).notNull(),
  createTime: bigint('create_time', { mode: 'number' }).notNull(),
  performTime: bigint('perform_time', { mode: 'number' }).notNull().default(0),
  cancelTime: bigint('cancel_time', { mode: 'number' }).notNull().default(0),
}, (t) => [
  // Bitta buyurtmaga bir vaqtda faqat bitta faol (state=1) Payme tranzaksiyasi
  uniqueIndex('payme_one_active_per_order').on(t.orderId).where(sql`state = 1`),
]);

/** Muvaffaqiyatsiz urinishlar (brute-force himoyasi) */
export const authAttempts = pgTable(
  'auth_attempts',
  {
    id: serial('id').primaryKey(),
    scope: text('scope').notNull(),
    key: text('key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('auth_attempts_idx').on(t.scope, t.key, t.createdAt)],
);

/** Xavfsizlik jurnali */
export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    actorType: text('actor_type').notNull(),
    actorId: integer('actor_id'),
    actorName: text('actor_name'),
    action: text('action').notNull(),
    detail: text('detail'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_created_idx').on(t.createdAt)],
);

/* ================= Moliya: hisob daftari, kassalar, oylik ================= */

/** Sabablar ma'lumotnomasi: davomat, ketish, muzlatish, lid rad etilishi */
export const reasons = pgTable('reasons', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  /** Faqat davomat uchun: shu sabab bilan kelmagan dars uchun pul yechiladimi */
  charges: boolean('charges').notNull().default(false),
  active: boolean('active').notNull().default(true),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** O'quvchi hisob daftari: har bir yechim (oylik, dars, tuzatish). Balans = to'lovlar − yechimlar */
export const charges = pgTable(
  'charges',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    enrollmentId: integer('enrollment_id').references(() => enrollments.id, { onDelete: 'set null' }),
    groupId: integer('group_id').references(() => groups.id, { onDelete: 'set null' }),
    /** 'oylik' | 'dars' | 'tuzatish' */
    kind: text('kind').notNull(),
    amount: integer('amount').notNull(),
    date: date('date').notNull(),
    month: text('month'),
    attendanceId: integer('attendance_id'),
    /** Abonement bilan bog'liq yechim (sotuv yoki abonementdan yechilgan dars) */
    subscriptionId: integer('subscription_id'),
    note: text('note'),
    createdById: integer('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('charges_student_idx').on(t.studentId),
    index('charges_date_idx').on(t.date),
    uniqueIndex('charges_att_uq').on(t.attendanceId).where(sql`attendance_id is not null`),
    uniqueIndex('charges_month_uq').on(t.enrollmentId, t.month).where(sql`kind = 'oylik'`),
  ],
);

/** Kassalar: asosiy kassa va xodimlarning shaxsiy kassalari */
export const cashboxes = pgTable('cashboxes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  ownerId: integer('owner_id').references(() => users.id, { onDelete: 'set null' }),
  isMain: boolean('is_main').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Kassadan kassaga pul o'tkazish (qabul qiluvchi tasdiqlaydi) */
export const cashTransfers = pgTable('cash_transfers', {
  id: serial('id').primaryKey(),
  fromId: integer('from_id')
    .notNull()
    .references(() => cashboxes.id),
  toId: integer('to_id')
    .notNull()
    .references(() => cashboxes.id),
  method: text('method').notNull().default('naqd'),
  amount: integer('amount').notNull(),
  /** 'kutilmoqda' | 'tasdiqlandi' | 'rad_etildi' */
  status: text('status').notNull().default('kutilmoqda'),
  note: text('note'),
  createdById: integer('created_by_id').references(() => users.id),
  confirmedById: integer('confirmed_by_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
});

/** Xodim bo'yicha bonus, jarima va avanslar (oy kesimida) */
export const staffAdjustments = pgTable(
  'staff_adjustments',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    /** 'bonus' | 'jarima' | 'avans' */
    kind: text('kind').notNull(),
    amount: integer('amount').notNull(),
    note: text('note'),
    transactionId: integer('transaction_id'),
    createdById: integer('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('adj_user_month_idx').on(t.userId, t.month)],
);

/** Berilgan oyliklar tarixi */
export const salaryPayouts = pgTable(
  'salary_payouts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    amount: integer('amount').notNull(),
    /** Hisob tafsiloti: oklad, ulush, bonus, jarima, avans */
    breakdown: text('breakdown'),
    transactionId: integer('transaction_id'),
    paidById: integer('paid_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('payout_user_month_uq').on(t.userId, t.month)],
);

/* ===================== 2-bosqich: sotuv va boshqaruv ===================== */

/** Sotuvchilarning oylik rejasi (nechta sotuv) */
export const salesPlans = pgTable(
  'sales_plans',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    target: integer('target').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('sales_plan_uq').on(t.userId, t.month)],
);

/** Xonalar (dars jadvali uchun) */
export const rooms = pgTable('rooms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  branchId: integer('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  capacity: integer('capacity').notNull().default(12),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Kunlik avtomatik ishlar bir kunda bir marta bajarilishi uchun */
export const jobRuns = pgTable('job_runs', {
  key: text('key').primaryKey(),
  ranAt: timestamp('ran_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ===================== 3-bosqich: aloqa va o'quvchi tajribasi ===================== */

/** Avtomatik xabar shablonlari (hodisa bo'yicha) */
export const messageTemplates = pgTable('message_templates', {
  event: text('event').primaryKey(),
  body: text('body').notNull(),
  active: boolean('active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Yuboriladigan / yuborilgan xabarlar navbati */
export const outbox = pgTable(
  'outbox',
  {
    id: serial('id').primaryKey(),
    event: text('event').notNull(),
    studentId: integer('student_id').references(() => students.id, { onDelete: 'cascade' }),
    branchId: integer('branch_id'),
    /** 'sms' | 'telegram' */
    channel: text('channel').notNull(),
    to: text('to').notNull(),
    body: text('body').notNull(),
    /** 'navbatda' | 'yuborildi' | 'xato' | 'qolda' (ulanmagan — qo'lda yuboriladi) | 'bekor' */
    status: text('status').notNull().default('navbatda'),
    error: text('error'),
    dedupeKey: text('dedupe_key'),
    attempts: integer('attempts').notNull().default(0),
    sendingAt: timestamp('sending_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('outbox_dedupe_uq').on(t.dedupeKey), index('outbox_status_idx').on(t.status)],
);

/** Coin hisobi: davomat, o'z vaqtida to'lov va o'qituvchi rag'bati uchun */
export const coins = pgTable(
  'coins',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    reason: text('reason').notNull(),
    /** Avtomatik berilgan coin takrorlanmasligi uchun */
    autoKey: text('auto_key'),
    createdById: integer('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('coins_student_idx').on(t.studentId), uniqueIndex('coins_auto_uq').on(t.autoKey)],
);

/* ===================== Abonementlar ===================== */

/** Abonement paketlari: N oylik yoki N darslik, chegirmali narx bilan */
export const subscriptionPlans = pgTable('subscription_plans', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  /** Faqat shu yo'nalish uchun (bo'sh — hammasi uchun) */
  courseId: integer('course_id').references(() => courses.id, { onDelete: 'set null' }),
  /** 'oy' — N oy (shu oylarning oylik to'lovi o'rniga); 'dars' — N ta dars (muddat ichida) */
  kind: text('kind').notNull().default('oy'),
  months: integer('months').notNull().default(1),
  lessons: integer('lessons').notNull().default(12),
  /** "dars" abonementi necha kun amal qiladi */
  validDays: integer('valid_days').notNull().default(60),
  price: integer('price').notNull(),
  /** Chegirmasiz narx (ko'rsatish uchun) */
  oldPrice: integer('old_price'),
  description: text('description'),
  color: text('color').notNull().default('#D93A08'),
  popular: boolean('popular').notNull().default(false),
  active: boolean('active').notNull().default(true),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** O'quvchiga sotilgan abonement */
export const studentSubscriptions = pgTable(
  'student_subscriptions',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    planId: integer('plan_id').references(() => subscriptionPlans.id, { onDelete: 'set null' }),
    enrollmentId: integer('enrollment_id')
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    lessonsTotal: integer('lessons_total').notNull().default(0),
    price: integer('price').notNull(),
    /** 'faol' | 'toxtatildi' (sanadan boshlab bekor, qolgani qaytarilgan) | 'bekor' (to'liq qaytarilgan) */
    status: text('status').notNull().default('faol'),
    refund: integer('refund').notNull().default(0),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelledById: integer('cancelled_by_id').references(() => users.id),
    cancelReason: text('cancel_reason'),
    createdById: integer('created_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('subs_student_idx').on(t.studentId), index('subs_enr_idx').on(t.enrollmentId)],
);
