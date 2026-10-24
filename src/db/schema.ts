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
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

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
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: roleEnum('role').notNull(),
  position: text('position'),
  baseSalary: integer('base_salary').notNull().default(0),
  bonusRule: text('bonus_rule'),
  active: boolean('active').notNull().default(true),
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
  teacherId: integer('teacher_id').references(() => users.id),
  supportId: integer('support_id').references(() => users.id),
  days: text('days').notNull().default('Du,Chor,Ju'),
  startTime: text('start_time').notNull().default('14:00'),
  endTime: text('end_time').notNull().default('16:00'),
  room: text('room'),
  capacity: integer('capacity').notNull().default(14),
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
    school: text('school'),
    address: text('address'),
    source: text('source'),
    status: studentStatusEnum('status').notNull().default('faol'),
    joinedAt: date('joined_at').notNull(),
    leftAt: date('left_at'),
    leftReason: text('left_reason'),
    returnAttempt: text('return_attempt'),
    returnResult: text('return_result'),
    graduatedAt: date('graduated_at'),
    note: text('note'),
    leadId: integer('lead_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('students_status_idx').on(t.status)],
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
    amount: integer('amount').notNull(),
    method: payMethodEnum('method').notNull().default('naqd'),
    forMonth: text('for_month'),
    paidAt: date('paid_at').notNull(),
    note: text('note'),
    receivedById: integer('received_by_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('pay_student_idx').on(t.studentId), index('pay_date_idx').on(t.paidAt)],
);

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    type: txTypeEnum('type').notNull(),
    category: text('category').notNull(),
    amount: integer('amount').notNull(),
    date: date('date').notNull(),
    method: text('method').notNull().default('bank'),
    counterparty: text('counterparty'),
    document: text('document'),
    note: text('note'),
    createdById: integer('created_by_id').references(() => users.id),
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
    courseId: integer('course_id').references(() => courses.id),
    stage: leadStageEnum('stage').notNull().default('yangi'),
    maxStage: integer('max_stage').notNull().default(0),
    assignedToId: integer('assigned_to_id').references(() => users.id),
    trialDate: date('trial_date'),
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
    doneAt: timestamp('done_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('tasks_assignee_idx').on(t.assigneeId)],
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
export type Role = (typeof roleEnum.enumValues)[number];
export type Course = typeof courses.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type LeadStage = (typeof leadStageEnum.enumValues)[number];
export type StudentStatus = (typeof studentStatusEnum.enumValues)[number];
