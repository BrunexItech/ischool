const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type UserRole = "super_admin" | "school_admin" | "teacher" | "staff" | "student" | "parent";

export interface User {
  id: number;
  school_id: number | null;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
}

export interface School {
  id: number;
  name: string;
  slug: string;
  custom_domain: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  country: string;
  currency: string;
  timezone: string;
  is_active: boolean;
  parent_school_id: number | null;
  branch_count: number;
}

export interface ModuleToggle {
  module_key: string;
  enabled: boolean;
}

export interface SchoolClass {
  id: number;
  school_id: number;
  name: string;
  grade_level: string | null;
  homeroom_teacher_id: number | null;
}

export interface Student {
  id: number;
  school_id: number;
  admission_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  class_id: number | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  is_active: boolean;
  has_student_account: boolean;
  has_guardian_account: boolean;
  user_id: number | null;
  guardian_user_id: number | null;
}

export interface Staff {
  id: number;
  user_id: number;
  school_id: number;
  email: string;
  full_name: string;
  role: UserRole;
  staff_number: string;
  department: string | null;
  phone: string | null;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: number;
  school_id: number;
  class_id: number;
  student_id: number;
  date: string;
  status: AttendanceStatus;
  recorded_by: number | null;
}

export interface Subject {
  id: number;
  school_id: number;
  name: string;
}

export interface Result {
  id: number;
  school_id: number;
  student_id: number;
  subject_id: number;
  term: string;
  score: number;
  grade: string | null;
  remarks: string | null;
}

export interface FeePayment {
  id: number;
  invoice_id: number;
  amount: number;
  method: string;
  reference: string | null;
  paid_at: string;
}

export interface FeeInvoice {
  id: number;
  school_id: number;
  student_id: number;
  term: string;
  category: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  status: "unpaid" | "partial" | "paid";
  due_date: string | null;
}

export interface FeeInvoiceDetail extends FeeInvoice {
  payments: FeePayment[];
}

export type AnnouncementAudience = "all" | "teachers" | "staff" | "students" | "parents";

export interface Announcement {
  id: number;
  school_id: number;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  class_id: number | null;
  event_date: string | null;
  event_end_date: string | null;
  location: string | null;
  created_by: number | null;
  created_at: string;
}

export type LiveClassStatus = "scheduled" | "live" | "ended";

export interface LiveClass {
  id: number;
  school_id: number;
  class_id: number | null;
  title: string;
  scheduled_start: string;
  status: LiveClassStatus;
  join_code: string;
}

export interface JoinToken {
  token: string;
  url: string;
  room_name: string;
  class_title: string;
}

export interface TeacherAssignment {
  id: number;
  school_id: number;
  teacher_user_id: number;
  class_id: number;
  subject_id: number | null;
}

export interface Notification {
  id: number;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AcademicTerm {
  id: number;
  school_id: number;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
}

export interface Vehicle {
  id: number;
  school_id: number;
  registration_number: string;
  capacity: number;
  driver_name: string;
  driver_phone: string;
  is_active: boolean;
}

export interface RouteStop {
  id: number;
  route_id: number;
  name: string;
  stop_order: number;
  pickup_time: string | null;
}

export interface TransportRoute {
  id: number;
  school_id: number;
  vehicle_id: number | null;
  name: string;
  description: string | null;
  stops: RouteStop[];
}

export interface StudentTransport {
  assigned: boolean;
  route_name: string | null;
  stop_name: string | null;
  pickup_time: string | null;
  vehicle_registration: string | null;
  driver_name: string | null;
  driver_phone: string | null;
}

export interface Activity {
  id: number;
  school_id: number;
  name: string;
  category: string | null;
  date: string;
  description: string | null;
  participant_count: number;
}

export interface ActivityParticipant {
  id: number;
  student_id: number;
  student_name: string;
  role: string | null;
}

export interface ActivityDetail extends Activity {
  participants: ActivityParticipant[];
}

export interface StudentActivity {
  activity_id: number;
  activity_name: string;
  category: string | null;
  date: string;
  role: string | null;
}

export type ExamQuestionType = "mcq" | "short_answer";
export type ExamSubmissionStatus = "in_progress" | "submitted" | "graded";

export interface ExamQuestion {
  id: number;
  question_text: string;
  question_type: ExamQuestionType;
  marks: number;
  order: number;
  options: string[] | null;
  correct_option_index: number | null;
}

export interface ExamQuestionForStudent {
  id: number;
  question_text: string;
  question_type: ExamQuestionType;
  marks: number;
  order: number;
  options: string[] | null;
}

export interface Exam {
  id: number;
  school_id: number;
  subject_id: number;
  class_id: number | null;
  title: string;
  term: string;
  duration_minutes: number;
  is_published: boolean;
  total_marks: number;
  question_count: number;
}

export interface ExamDetail extends Exam {
  questions: ExamQuestion[];
}

export interface ExamForStudent extends Exam {
  questions: ExamQuestionForStudent[];
}

export interface ExamForStudentListItem extends Exam {
  subject_name: string;
  submission_status: ExamSubmissionStatus | null;
  score: number | null;
}

export interface ExamSubmission {
  id: number;
  exam_id: number;
  student_id: number;
  status: ExamSubmissionStatus;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
}

export interface ExamSubmissionAnswer {
  id: number;
  question_id: number;
  answer_text: string | null;
  awarded_marks: number | null;
}

export interface ExamSubmissionDetail extends ExamSubmission {
  answers: ExamSubmissionAnswer[];
  student_name: string;
}

export interface ReportCardRow {
  subject_name: string;
  score: number;
  grade: string | null;
  remarks: string | null;
}

export interface ReportCard {
  school_name: string;
  school_logo_url: string | null;
  school_primary_color: string;
  student_name: string;
  admission_number: string;
  class_name: string | null;
  term: string;
  rows: ReportCardRow[];
  average: number | null;
  overall_grade: string | null;
}

export interface PickupDropoffLog {
  id: number;
  school_id: number;
  student_id: number;
  event_type: "pickup" | "dropoff";
  person_name: string;
  notes: string | null;
  occurred_at: string;
}

export interface Expense {
  id: number;
  school_id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  created_at: string;
}

export interface FinanceSummary {
  total_income: number;
  total_expenses: number;
  net: number;
  expenses_by_category: { category: string; total: number }[];
  monthly: { month: string; income: number; expenses: number }[];
}

export interface ResultsAnalytics {
  overall_average: number | null;
  result_count: number;
  subject_averages: { subject: string; average: number; count: number }[];
  class_averages: { class_name: string; average: number; count: number }[];
  grade_distribution: { grade: string; count: number }[];
  top_students: { student_name: string; average: number }[];
  term_trend: { term: string; average: number }[];
}

export interface Award {
  id: number;
  school_id: number;
  student_id: number | null;
  staff_user_id: number | null;
  recipient_name: string;
  title: string;
  description: string | null;
  category: string | null;
  date_awarded: string;
}

export interface MealMenuEntry {
  id: number;
  school_id: number;
  date: string;
  meal_type: "breakfast" | "lunch" | "snack";
  description: string;
}

export interface PaymentConfigStatus {
  mpesa_configured: boolean;
  mpesa_shortcode: string | null;
  mpesa_env: string | null;
  card_configured: boolean;
  pesapal_env: string | null;
}

export interface PaymentMethods {
  mpesa: boolean;
  card: boolean;
}

export interface PaymentTransaction {
  id: number;
  invoice_id: number;
  merchant_reference: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed";
  method: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CardPaymentInitiated {
  transaction: PaymentTransaction;
  checkout_url: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  actor_name: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> ?? {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams({ username: email, password });
    return request<{ access_token: string; token_type: string; user: User }>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  },

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ access_token: string; token_type: string; user: User }>(
      "/auth/change-password",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      },
      token
    ),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }),

  resetPassword: (resetToken: string, newPassword: string) =>
    request<{ access_token: string; token_type: string; user: User }>("/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, new_password: newPassword }),
    }),

  adminResetPassword: (token: string, schoolId: number, userId: number, newPassword: string) =>
    request<{ id: number }>(
      `/schools/${schoolId}/users/${userId}/reset-password`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ new_password: newPassword }) },
      token
    ),

  getSchoolBySlug: (slug: string) =>
    request<{ name: string; slug: string; logo_url: string | null; primary_color: string; secondary_color: string }>(
      `/schools/by-slug/${slug}`
    ),

  listSchools: (token: string) => request<School[]>("/schools", {}, token),

  onboardSchool: (
    token: string,
    payload: {
      name: string;
      slug: string;
      country: string;
      currency: string;
      timezone: string;
      admin_email: string;
      admin_full_name: string;
      admin_password: string;
      parent_school_id?: number;
    }
  ) => request<School>("/schools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, token),

  getSchool: (token: string, schoolId: number) => request<School>(`/schools/${schoolId}`, {}, token),

  listBranches: (token: string, schoolId: number) => request<School[]>(`/schools/${schoolId}/branches`, {}, token),

  updateBranding: (
    token: string,
    schoolId: number,
    payload: Partial<{ name: string; logo_url: string; primary_color: string; secondary_color: string; custom_domain: string }>
  ) =>
    request<School>(
      `/schools/${schoolId}/branding`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  uploadSchoolLogo: (token: string, schoolId: number, file: File) => {
    const form = new FormData();
    form.append("logo", file);
    return request<School>(`/schools/${schoolId}/branding/logo`, { method: "POST", body: form }, token);
  },

  listModules: (token: string, schoolId: number) =>
    request<ModuleToggle[]>(`/schools/${schoolId}/modules`, {}, token),

  toggleModule: (token: string, schoolId: number, moduleKey: string, enabled: boolean) =>
    request<ModuleToggle>(
      `/schools/${schoolId}/modules/${moduleKey}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) },
      token
    ),

  listClasses: (token: string, schoolId: number) =>
    request<SchoolClass[]>(`/schools/${schoolId}/classes`, {}, token),

  createClass: (token: string, schoolId: number, payload: { name: string; grade_level?: string }) =>
    request<SchoolClass>(
      `/schools/${schoolId}/classes`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  promoteClass: (token: string, schoolId: number, classId: number, toClassId: number | null) =>
    request<{ moved_count: number; from_class_id: number; to_class_id: number | null; graduated: boolean }>(
      `/schools/${schoolId}/classes/${classId}/promote`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to_class_id: toClassId }) },
      token
    ),

  listStudents: (token: string, schoolId: number, classId?: number) =>
    request<Student[]>(
      `/schools/${schoolId}/students${classId ? `?class_id=${classId}` : ""}`,
      {},
      token
    ),

  createStudent: (
    token: string,
    schoolId: number,
    payload: {
      admission_number: string;
      first_name: string;
      last_name: string;
      class_id?: number;
      guardian_name?: string;
      guardian_phone?: string;
      guardian_email?: string;
    }
  ) =>
    request<Student>(
      `/schools/${schoolId}/students`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  createStudentAccount: (token: string, schoolId: number, studentId: number, payload: { email: string; password: string }) =>
    request<Student>(
      `/schools/${schoolId}/students/${studentId}/student-account`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  createGuardianAccount: (
    token: string,
    schoolId: number,
    studentId: number,
    payload: { email: string; password: string; full_name?: string }
  ) =>
    request<Student>(
      `/schools/${schoolId}/students/${studentId}/guardian-account`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listStaff: (token: string, schoolId: number) => request<Staff[]>(`/schools/${schoolId}/staff`, {}, token),

  createStaff: (
    token: string,
    schoolId: number,
    payload: {
      email: string;
      full_name: string;
      password: string;
      role: "teacher" | "staff";
      staff_number: string;
      department?: string;
      phone?: string;
    }
  ) =>
    request<Staff>(
      `/schools/${schoolId}/staff`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  // --- Attendance ---

  listAttendance: (token: string, schoolId: number, classId: number, date: string) =>
    request<AttendanceRecord[]>(
      `/schools/${schoolId}/attendance?class_id=${classId}&date=${date}`,
      {},
      token
    ),

  markAttendance: (
    token: string,
    schoolId: number,
    payload: { class_id: number; date: string; records: { student_id: number; status: AttendanceStatus }[] }
  ) =>
    request<AttendanceRecord[]>(
      `/schools/${schoolId}/attendance`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  // --- Results ---

  listSubjects: (token: string, schoolId: number) => request<Subject[]>(`/schools/${schoolId}/subjects`, {}, token),

  createSubject: (token: string, schoolId: number, name: string) =>
    request<Subject>(
      `/schools/${schoolId}/subjects`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) },
      token
    ),

  listResults: (token: string, schoolId: number, params: { student_id?: number; subject_id?: number; term?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<Result[]>(`/schools/${schoolId}/results${qs ? `?${qs}` : ""}`, {}, token);
  },

  getReportCard: (token: string, schoolId: number, studentId: number, term: string) =>
    request<ReportCard>(`/schools/${schoolId}/students/${studentId}/report-card?term=${encodeURIComponent(term)}`, {}, token),

  getChildReportCard: (token: string, studentId: number, term: string) =>
    request<ReportCard>(`/portal/students/${studentId}/report-card?term=${encodeURIComponent(term)}`, {}, token),

  getResultsAnalytics: (token: string, schoolId: number, term?: string) =>
    request<ResultsAnalytics>(`/schools/${schoolId}/analytics/results${term ? `?term=${encodeURIComponent(term)}` : ""}`, {}, token),

  // --- Exams ---

  listExams: (token: string, schoolId: number) => request<Exam[]>(`/schools/${schoolId}/exams`, {}, token),

  createExam: (
    token: string,
    schoolId: number,
    payload: {
      subject_id: number;
      class_id?: number;
      title: string;
      term: string;
      duration_minutes: number;
      questions: {
        question_text: string;
        question_type: ExamQuestionType;
        marks: number;
        order: number;
        options?: string[];
        correct_option_index?: number;
      }[];
    }
  ) =>
    request<ExamDetail>(
      `/schools/${schoolId}/exams`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  getExam: (token: string, schoolId: number, examId: number) => request<ExamDetail>(`/schools/${schoolId}/exams/${examId}`, {}, token),

  setExamPublished: (token: string, schoolId: number, examId: number, published: boolean) =>
    request<Exam>(`/schools/${schoolId}/exams/${examId}/publish?published=${published}`, { method: "PATCH" }, token),

  deleteExam: (token: string, schoolId: number, examId: number) =>
    request<void>(`/schools/${schoolId}/exams/${examId}`, { method: "DELETE" }, token),

  listExamSubmissions: (token: string, schoolId: number, examId: number) =>
    request<ExamSubmissionDetail[]>(`/schools/${schoolId}/exams/${examId}/submissions`, {}, token),

  gradeExamAnswer: (token: string, schoolId: number, examId: number, submissionId: number, answerId: number, awardedMarks: number) =>
    request<ExamSubmissionDetail>(
      `/schools/${schoolId}/exams/${examId}/submissions/${submissionId}/answers/${answerId}/grade`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ awarded_marks: awardedMarks }) },
      token
    ),

  getChildExams: (token: string, studentId: number) => request<ExamForStudentListItem[]>(`/portal/students/${studentId}/exams`, {}, token),

  startExam: (token: string, studentId: number, examId: number) =>
    request<{ exam: ExamForStudent; submission: ExamSubmission; answers: ExamSubmissionAnswer[] }>(
      `/portal/students/${studentId}/exams/${examId}/start`,
      { method: "POST" },
      token
    ),

  autosaveExamAnswer: (token: string, studentId: number, examId: number, questionId: number, answerText: string) =>
    request<{ saved: boolean }>(
      `/portal/students/${studentId}/exams/${examId}/answer`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question_id: questionId, answer_text: answerText }) },
      token
    ),

  submitExam: (token: string, studentId: number, examId: number, answers: { question_id: number; answer_text: string }[]) =>
    request<ExamSubmission>(
      `/portal/students/${studentId}/exams/${examId}/submit`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) },
      token
    ),

  // --- Pickup / Drop-off ---

  listPickupDropoff: (token: string, schoolId: number, studentId: number) =>
    request<PickupDropoffLog[]>(`/schools/${schoolId}/students/${studentId}/pickup-dropoff`, {}, token),

  logPickupDropoff: (
    token: string,
    schoolId: number,
    studentId: number,
    payload: { event_type: "pickup" | "dropoff"; person_name: string; notes?: string }
  ) =>
    request<PickupDropoffLog>(
      `/schools/${schoolId}/students/${studentId}/pickup-dropoff`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deletePickupDropoff: (token: string, schoolId: number, studentId: number, logId: number) =>
    request<void>(`/schools/${schoolId}/students/${studentId}/pickup-dropoff/${logId}`, { method: "DELETE" }, token),

  getChildPickupDropoff: (token: string, studentId: number) =>
    request<PickupDropoffLog[]>(`/portal/students/${studentId}/pickup-dropoff`, {}, token),

  // --- Finance ---

  listExpenses: (token: string, schoolId: number) => request<Expense[]>(`/schools/${schoolId}/finance/expenses`, {}, token),

  createExpense: (token: string, schoolId: number, payload: { category: string; description: string; amount: number; date: string }) =>
    request<Expense>(
      `/schools/${schoolId}/finance/expenses`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteExpense: (token: string, schoolId: number, expenseId: number) =>
    request<void>(`/schools/${schoolId}/finance/expenses/${expenseId}`, { method: "DELETE" }, token),

  getFinanceSummary: (token: string, schoolId: number) => request<FinanceSummary>(`/schools/${schoolId}/finance/summary`, {}, token),

  upsertResult: (
    token: string,
    schoolId: number,
    payload: { student_id: number; subject_id: number; term: string; score: number; remarks?: string }
  ) =>
    request<Result>(
      `/schools/${schoolId}/results`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  // --- Fees ---

  listInvoices: (token: string, schoolId: number, studentId?: number) =>
    request<FeeInvoice[]>(
      `/schools/${schoolId}/fees/invoices${studentId ? `?student_id=${studentId}` : ""}`,
      {},
      token
    ),

  createInvoice: (
    token: string,
    schoolId: number,
    payload: { student_id: number; term: string; category?: string; amount_due: number; due_date?: string }
  ) =>
    request<FeeInvoice>(
      `/schools/${schoolId}/fees/invoices`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  getInvoice: (token: string, schoolId: number, invoiceId: number) =>
    request<FeeInvoiceDetail>(`/schools/${schoolId}/fees/invoices/${invoiceId}`, {}, token),

  recordPayment: (
    token: string,
    schoolId: number,
    invoiceId: number,
    payload: { amount: number; method: string; reference?: string }
  ) =>
    request<FeeInvoiceDetail>(
      `/schools/${schoolId}/fees/invoices/${invoiceId}/payments`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  // --- Communication ---

  listAnnouncements: (token: string, schoolId: number) =>
    request<Announcement[]>(`/schools/${schoolId}/announcements`, {}, token),

  createAnnouncement: (
    token: string,
    schoolId: number,
    payload: {
      title: string;
      body: string;
      audience: AnnouncementAudience;
      class_id?: number;
      event_date?: string;
      event_end_date?: string;
      location?: string;
    }
  ) =>
    request<Announcement>(
      `/schools/${schoolId}/announcements`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  // --- Live classes ---

  listLiveClasses: (token: string, schoolId: number) =>
    request<LiveClass[]>(`/schools/${schoolId}/live-classes`, {}, token),

  scheduleLiveClass: (
    token: string,
    schoolId: number,
    payload: { title: string; scheduled_start: string; class_id?: number }
  ) =>
    request<LiveClass>(
      `/schools/${schoolId}/live-classes`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  getHostToken: (token: string, schoolId: number, liveClassId: number) =>
    request<JoinToken>(`/schools/${schoolId}/live-classes/${liveClassId}/host-token`, { method: "POST" }, token),

  joinLiveClassByCode: (joinCode: string, name: string) =>
    request<JoinToken>(`/live-classes/join/${joinCode}?name=${encodeURIComponent(name)}`),

  // --- Portal (parent/student self-service) ---

  listMyChildren: (token: string) => request<Student[]>("/portal/children", {}, token),

  getMyStudentRecord: (token: string) => request<Student>("/portal/me", {}, token),

  getChildAttendance: (token: string, studentId: number) =>
    request<AttendanceRecord[]>(`/portal/students/${studentId}/attendance`, {}, token),

  getChildResults: (token: string, studentId: number) =>
    request<Result[]>(`/portal/students/${studentId}/results`, {}, token),

  getChildFees: (token: string, studentId: number) =>
    request<FeeInvoice[]>(`/portal/students/${studentId}/fees`, {}, token),

  // --- Teacher assignments ---

  listTeacherAssignments: (token: string, schoolId: number) =>
    request<TeacherAssignment[]>(`/schools/${schoolId}/teacher-assignments`, {}, token),

  createTeacherAssignment: (
    token: string,
    schoolId: number,
    payload: { teacher_user_id: number; class_id: number; subject_id?: number }
  ) =>
    request<TeacherAssignment>(
      `/schools/${schoolId}/teacher-assignments`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteTeacherAssignment: (token: string, schoolId: number, assignmentId: number) =>
    request<void>(`/schools/${schoolId}/teacher-assignments/${assignmentId}`, { method: "DELETE" }, token),

  // --- Audit log ---

  listAuditLog: (token: string, schoolId: number) =>
    request<AuditLogEntry[]>(`/schools/${schoolId}/audit-log`, {}, token),

  // --- Notifications ---

  listNotifications: (token: string) => request<Notification[]>("/notifications", {}, token),

  getUnreadNotificationCount: (token: string) => request<{ count: number }>("/notifications/unread-count", {}, token),

  markNotificationRead: (token: string, notificationId: number) =>
    request<Notification>(`/notifications/${notificationId}/read`, { method: "PATCH" }, token),

  markAllNotificationsRead: (token: string) =>
    request<{ message: string }>("/notifications/read-all", { method: "PATCH" }, token),

  // --- Academic terms ---

  listAcademicTerms: (token: string, schoolId: number) =>
    request<AcademicTerm[]>(`/schools/${schoolId}/academic-terms`, {}, token),

  createAcademicTerm: (
    token: string,
    schoolId: number,
    payload: { name: string; start_date?: string; end_date?: string }
  ) =>
    request<AcademicTerm>(
      `/schools/${schoolId}/academic-terms`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  setCurrentAcademicTerm: (token: string, schoolId: number, termId: number) =>
    request<AcademicTerm>(`/schools/${schoolId}/academic-terms/${termId}/set-current`, { method: "PATCH" }, token),

  // --- Transport ---

  listVehicles: (token: string, schoolId: number) => request<Vehicle[]>(`/schools/${schoolId}/transport/vehicles`, {}, token),

  createVehicle: (
    token: string,
    schoolId: number,
    payload: { registration_number: string; capacity: number; driver_name: string; driver_phone: string }
  ) =>
    request<Vehicle>(
      `/schools/${schoolId}/transport/vehicles`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listTransportRoutes: (token: string, schoolId: number) =>
    request<TransportRoute[]>(`/schools/${schoolId}/transport/routes`, {}, token),

  createTransportRoute: (
    token: string,
    schoolId: number,
    payload: { name: string; description?: string; vehicle_id?: number }
  ) =>
    request<TransportRoute>(
      `/schools/${schoolId}/transport/routes`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  addRouteStop: (
    token: string,
    schoolId: number,
    routeId: number,
    payload: { name: string; stop_order: number; pickup_time?: string }
  ) =>
    request<TransportRoute>(
      `/schools/${schoolId}/transport/routes/${routeId}/stops`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  assignStudentTransport: (
    token: string,
    schoolId: number,
    studentId: number,
    payload: { transport_route_id: number | null; transport_stop_id: number | null }
  ) =>
    request<{ message: string }>(
      `/schools/${schoolId}/transport/students/${studentId}/assignment`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  getChildTransport: (token: string, studentId: number) =>
    request<StudentTransport>(`/portal/students/${studentId}/transport`, {}, token),

  // --- Meals ---

  listMealMenu: (token: string, schoolId: number, dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const qs = params.toString();
    return request<MealMenuEntry[]>(`/schools/${schoolId}/meal-menu${qs ? `?${qs}` : ""}`, {}, token);
  },

  createMealMenuEntry: (
    token: string,
    schoolId: number,
    payload: { date: string; meal_type: "breakfast" | "lunch" | "snack"; description: string }
  ) =>
    request<MealMenuEntry>(
      `/schools/${schoolId}/meal-menu`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  updateMealMenuEntry: (token: string, schoolId: number, menuId: number, payload: { description: string }) =>
    request<MealMenuEntry>(
      `/schools/${schoolId}/meal-menu/${menuId}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteMealMenuEntry: (token: string, schoolId: number, menuId: number) =>
    request<void>(`/schools/${schoolId}/meal-menu/${menuId}`, { method: "DELETE" }, token),

  getChildMealMenu: (token: string, studentId: number, dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    const qs = params.toString();
    return request<MealMenuEntry[]>(`/portal/students/${studentId}/meal-menu${qs ? `?${qs}` : ""}`, {}, token);
  },

  // --- Awards ---

  listAwards: (token: string, schoolId: number) => request<Award[]>(`/schools/${schoolId}/awards`, {}, token),

  createAward: (
    token: string,
    schoolId: number,
    payload: {
      student_id?: number;
      staff_user_id?: number;
      title: string;
      description?: string;
      category?: string;
      date_awarded: string;
    }
  ) =>
    request<Award>(
      `/schools/${schoolId}/awards`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteAward: (token: string, schoolId: number, awardId: number) =>
    request<void>(`/schools/${schoolId}/awards/${awardId}`, { method: "DELETE" }, token),

  getChildAwards: (token: string, studentId: number) => request<Award[]>(`/portal/students/${studentId}/awards`, {}, token),

  // --- Activities & Competitions ---

  listActivities: (token: string, schoolId: number) => request<Activity[]>(`/schools/${schoolId}/activities`, {}, token),

  createActivity: (
    token: string,
    schoolId: number,
    payload: { name: string; category?: string; date: string; description?: string }
  ) =>
    request<Activity>(
      `/schools/${schoolId}/activities`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  getActivity: (token: string, schoolId: number, activityId: number) =>
    request<ActivityDetail>(`/schools/${schoolId}/activities/${activityId}`, {}, token),

  addActivityParticipant: (token: string, schoolId: number, activityId: number, payload: { student_id: number; role?: string }) =>
    request<ActivityParticipant>(
      `/schools/${schoolId}/activities/${activityId}/participants`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  removeActivityParticipant: (token: string, schoolId: number, activityId: number, studentId: number) =>
    request<void>(`/schools/${schoolId}/activities/${activityId}/participants/${studentId}`, { method: "DELETE" }, token),

  deleteActivity: (token: string, schoolId: number, activityId: number) =>
    request<void>(`/schools/${schoolId}/activities/${activityId}`, { method: "DELETE" }, token),

  getChildActivities: (token: string, studentId: number) =>
    request<StudentActivity[]>(`/portal/students/${studentId}/activities`, {}, token),

  // --- Payments ---

  getPaymentConfig: (token: string, schoolId: number) =>
    request<PaymentConfigStatus>(`/schools/${schoolId}/payment-config`, {}, token),

  setPaymentConfig: (
    token: string,
    schoolId: number,
    payload: Partial<{
      mpesa_shortcode: string;
      mpesa_consumer_key: string;
      mpesa_consumer_secret: string;
      mpesa_passkey: string;
      mpesa_env: "sandbox" | "production";
      pesapal_consumer_key: string;
      pesapal_consumer_secret: string;
      pesapal_env: "sandbox" | "production";
    }>
  ) =>
    request<PaymentConfigStatus>(
      `/schools/${schoolId}/payment-config`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  getChildPaymentMethods: (token: string, studentId: number) =>
    request<PaymentMethods>(`/portal/students/${studentId}/payment-methods`, {}, token),

  payInvoiceWithMpesa: (
    token: string,
    studentId: number,
    invoiceId: number,
    payload: { phone_number: string; amount?: number }
  ) =>
    request<PaymentTransaction>(
      `/portal/students/${studentId}/fees/${invoiceId}/pay/mpesa`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  checkMpesaPaymentStatus: (token: string, studentId: number, invoiceId: number, transactionId: number) =>
    request<PaymentTransaction>(
      `/portal/students/${studentId}/fees/${invoiceId}/pay/mpesa/${transactionId}/status`,
      {},
      token
    ),

  payInvoiceWithCard: (token: string, studentId: number, invoiceId: number, payload: { amount?: number }) =>
    request<CardPaymentInitiated>(
      `/portal/students/${studentId}/fees/${invoiceId}/pay/card`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  checkCardPaymentStatus: (token: string, studentId: number, invoiceId: number, transactionId: number) =>
    request<PaymentTransaction>(
      `/portal/students/${studentId}/fees/${invoiceId}/pay/card/${transactionId}/status`,
      {},
      token
    ),
};

export { ApiError };
