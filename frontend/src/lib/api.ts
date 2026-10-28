const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type UserRole =
  | "super_admin"
  | "head_of_institution"
  | "teacher"
  | "staff"
  | "student"
  | "parent"
  | "security"
  | "boarding_staff"
  | "transport_staff"
  | "transport_attendant"
  | "librarian"
  | "store_keeper"
  | "accountant"
  | "procurement_officer"
  | "bursar"
  | "secretary"
  | "group_principal";

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
  plan_id: number | null;
  subscription_status: "trialing" | "active" | "past_due" | "suspended";
  trial_ends_at: string;
  expense_approval_threshold: number;
}

export interface PlatformOverview {
  total_schools: number;
  total_students: number;
  total_teachers: number;
  total_active_staff: number;
  total_amount_billed: number;
  total_amount_paid: number;
  overall_fee_collection_rate: number;
}

export interface Plan {
  id: number;
  name: string;
  price: number;
  currency: string;
  billing_period: "monthly" | "annual";
  max_students: number | null;
  is_active: boolean;
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
  grade_level_id: number | null;
  homeroom_teacher_id: number | null;
}

export type LevelGroup = "pre_primary" | "primary" | "junior_school" | "senior_school";

export interface GradeLevel {
  id: number;
  code: string;
  display_name: string;
  level_group: LevelGroup;
  sort_order: number;
}

export type PerformanceLevel = "exceeding_expectation" | "meeting_expectation" | "approaching_expectation" | "below_expectation";

export interface CompetencyAssessment {
  id: number;
  school_id: number;
  student_id: number;
  class_id: number;
  subject_id: number;
  teacher_user_id: number | null;
  term: string;
  strand: string;
  sub_strand: string | null;
  criterion: string;
  performance_level: PerformanceLevel;
  assessment_date: string;
  teacher_comment: string | null;
  follow_up_action: string | null;
  created_at: string;
}

export interface ObservationNote {
  id: number;
  school_id: number;
  student_id: number;
  class_id: number;
  teacher_user_id: number | null;
  subject_id: number | null;
  strand: string | null;
  note: string;
  noted_on: string;
  created_at: string;
}

export interface FamilyChildCard {
  student: Student;
  today: string;
  attendance: { present: number; absent: number; late: number; excused: number; marked: number; rate: number | null; today: string | null } | null;
  fees: { balance: number; billed: number; paid: number; unpaid_invoices: number } | null;
  homework: { open: number; overdue: number; next: { id: number; title: string; subject: string; due_date: string; overdue: boolean }[] } | null;
  lessons: { subject: string; teacher: string | null; room: string | null; start: string; end: string }[] | null;
  latest_award: { title: string; date: string } | null;
}
export interface FamilyOverview { children: FamilyChildCard[] }

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
  upi_number?: string | null;
  assessment_number?: string | null;
  index_number?: string | null;
  birth_certificate_number?: string | null;
  nationality?: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  is_active: boolean;
  has_student_account: boolean;
  has_guardian_account: boolean;
  user_id: number | null;
  guardian_user_id: number | null;
  transport_route_id: number | null;
  class_name?: string | null;
}

export interface ExamReadiness {
  groups: { grade_code: string; grade_name: string; exam: string; needs: string[]; learners: number; complete: number; rows: { student_id: number; name: string; admission_number: string; class_name: string; missing: string[] }[] }[];
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
  tsc_number: string | null;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: number;
  school_id: number;
  class_id: number;
  student_id: number;
  date: string;
  status: AttendanceStatus;
  reason: string | null;
  recorded_by: number | null;
}

export interface Subject {
  id: number;
  school_id: number;
  name: string;
  grade_level_ids?: number[];
}

export interface TopLearner {
  student_id: number;
  name: string;
  class_name: string;
  admission_number: string;
  average: number;
  rank: number;
  level: string | null;
}

export interface ClassPerformance {
  class_id: number;
  class_name: string;
  level: string;
  teacher: string | null;
  learners: number;
  marked: number;
  average: number | null;
  pass_rate: number | null;
  ranked: boolean;
  top: TopLearner[];
  best_subject: { subject: string; average: number } | null;
  weakest_subject: { subject: string; average: number } | null;
  distribution: Record<string, number>;
}

export interface PerformanceOverview {
  term: string | null;
  exam_types: string[];
  available_exam_types: string[];
  school_average: number | null;
  classes: ClassPerformance[];
  top_learners: TopLearner[];
}

export interface ClassTeacherRow {
  class_id: number;
  class_name: string;
  level: string;
  teacher_user_id: number | null;
  teacher_name: string | null;
}

export interface Result {
  id: number;
  school_id: number;
  student_id: number;
  subject_id: number;
  term: string;
  exam_type: string;
  score: number;
  grade: string | null;
  remarks: string | null;
  recorded_by: number | null;
  subject_name?: string | null;
}

export interface BoardSubject {
  id: number;
  name: string;
}

export interface BoardStudent {
  student_id: number;
  name: string;
  admission_number: string;
  scores: Record<string, number | null>;
  levels: Record<string, string | null>;
  total: number;
  average: number | null;
  level: string | null;
  subjects_marked: number;
  rank: number | null;
}

export interface ResultsBoard {
  class_id: number;
  class_name: string;
  term: string;
  selected_exam_types: string[];
  available_exam_types: string[];
  subjects: BoardSubject[];
  students: BoardStudent[];
  bands: { level_code: string; label: string; min_score: number; max_score: number }[];
  ranked: boolean;
  class_average: number | null;
}

export interface GradingBand {
  id: number;
  school_id: number;
  level_code: string;
  label: string;
  min_score: number;
  max_score: number;
  points: number;
  sort_order: number;
}

export interface FeePayment {
  id: number;
  invoice_id: number;
  amount: number;
  method: string;
  reference: string | null;
  paid_at: string;
}

export interface FeePaymentHistory extends FeePayment {
  student_id: number;
  student_name: string;
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
  target_roles?: string[] | null;
  event_date: string | null;
  event_end_date: string | null;
  location: string | null;
  created_by: number | null;
  created_by_name?: string | null;
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

export interface MyClassSubject {
  subject_id: number;
  subject_name: string;
}

export interface MyClass {
  class_id: number;
  class_name: string;
  is_homeroom_teacher: boolean;
  can_mark_attendance: boolean;
  subjects: MyClassSubject[];
  student_count: number;
  attendance_marked_today: boolean;
}

export interface MenuSlot {
  id?: number;
  position?: number;
  name: string;
  start_time: string;
  end_time: string;
  audience: "all" | "boarders";
  items: Record<string, string>;
}

export interface GroupSchoolInfo { id: number; name: string }
export interface GroupModuleInfo { key: string; title: string; blurb: string }
export interface GroupColumn { key: string; label: string; kind: "count" | "percent" | "money" | "score" | "decimal"; better: "high" | "low" | null; hint: string | null }
export interface GroupRow { school_id: number; school_name: string; enabled: boolean; unavailable?: boolean; values: Record<string, number | null> }
export interface GroupComparison { key: string; title: string; blurb: string; href: string; columns: GroupColumn[]; rows: GroupRow[]; group: Record<string, number | null>; marks: Record<string, { best: string; weakest: string }>; date?: string | null }
export interface GroupSchoolCard { school_id: number; name: string; learners: number; teachers: number; attendance_today: number | null; registers_taken: number | null; registers_total: number | null; fee_rate: number | null; outstanding: number; attention: number; urgent: number }
export interface GroupAttention { school_id: number; school_name: string; text: string; tone: string; href: string | null }
export interface GroupDecision { school_id: number; school_name: string; kind: string; title: string; detail: string; age_days: number }
export interface GroupAttentionSummary { per_school: Record<string, { attention: number; urgent: number }>; total: number; urgent: number; items: GroupAttention[]; spotlight: string[] }
export interface GroupOverview { week_start: string | null; week_end: string | null; principal: string; schools: GroupSchoolCard[]; learners: number; teachers: number; attendance_today: number | null; fee_rate: number | null; outstanding: number; attention_total: number; attention: GroupAttention[]; decisions: GroupDecision[]; spotlight: string[] }
export interface GroupActivityEvent extends ActivityEvent { school_id: number; school_name: string }
export interface GroupActivity { start: string; end: string; total: number; counts: Record<string, number>; by_school: Record<string, number>; events: GroupActivityEvent[] }
export interface GroupReportSection { key: string; title: string; href: string; columns: GroupColumn[]; rows: GroupRow[]; group: Record<string, number | null> }
export interface GroupWeeklyReport { principal: string; week_start: string; week_end: string; headline: string; schools: GroupSchoolCard[]; attention: GroupAttention[]; decisions: GroupDecision[]; spotlight: string[]; sections: GroupReportSection[] }

export interface StaffMeeting { id: number; title: string; agenda: string | null; scheduled_start: string; status: "scheduled" | "live" | "ended" | "cancelled"; host_name: string; is_host: boolean; school_names: string[]; audience: "all" | "selected"; invited: number; joined: number }
export interface MeetingCandidateSchool { school_id: number; school_name: string; teachers: { user_id: number; full_name: string }[] }
export interface MeetingAttendance { meeting: StaffMeeting; attendees: { user_id: number; name: string; school_name: string | null; joined_at: string | null }[] }

export interface LibBook {
  id: number;
  title: string;
  author: string | null;
  isbn: string | null;
  category: string | null;
  shelf: string | null;
  subject_name: string | null;
  total_copies: number;
  available: number;
  on_loan: number;
  lost: number;
}

export interface LibHolder {
  loan_id: number;
  kind: "student" | "teacher";
  name: string;
  class_name: string | null;
  via_teacher: string | null;
  due_date: string;
  overdue: boolean;
}

export interface LibCopy {
  id: number;
  copy_number: string;
  condition: string;
  status: "available" | "on_loan" | "lost" | "withdrawn";
  holder: LibHolder | null;
}

export interface LibBookDetail {
  book: LibBook;
  copies: LibCopy[];
}

export interface LibLoan {
  id: number;
  copy_number: string;
  title: string;
  author: string | null;
  borrower_kind: "student" | "teacher";
  borrower_name: string;
  class_name: string | null;
  via_teacher: string | null;
  issued_by_name: string | null;
  issued_at: string;
  due_date: string;
  returned_at: string | null;
  overdue: boolean;
  days_overdue: number;
  parent_loan_id: number | null;
  active: boolean;
}

export interface LibClassSet {
  loan_id: number;
  teacher_id: number;
  teacher_name: string;
  class_name: string | null;
  titles: string[];
  copies: number;
  with_learners: number;
  due_date: string;
  overdue: boolean;
  copy_numbers: string[];
}

export interface LibOverview {
  titles: number;
  copies: number;
  available: number;
  on_loan: number;
  lost: number;
  overdue: number;
  borrowers_now: number;
  class_sets: LibClassSet[];
  overdue_loans: LibLoan[];
  recent: LibLoan[];
  popular: { title: string; loans: number }[];
}

export interface FeeStructure {
  term: string;
  lines: { id: number; grade_level_id: number; category: string; amount: number; grade_code: string; grade_name: string }[];
  learners_by_grade: Record<string, number>;
}

export interface FeeBalanceRow {
  student_id: number;
  name: string;
  admission_number: string;
  class_name: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  billed: number;
  paid: number;
  balance: number;
  arrears: number;
  total_owed: number;
}

export interface FeeBalances {
  term: string | null;
  rows: FeeBalanceRow[];
  totals: Record<string, number>;
}

export interface LeadershipAccount {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface PeriodDraft {
  name: string;
  kind: string;
  start_time: string;
  end_time: string;
  days: number[];
}

export interface SchoolPeriod extends PeriodDraft {
  id: number;
  level_group: string;
  position: number;
}

export interface ChangeRequest {
  id: number;
  kind: string;
  scope: string | null;
  title: string;
  summary: string;
  status: "pending" | "approved" | "rejected";
  requested_by_name: string | null;
  requested_at: string;
  decision_note: string | null;
}

export interface TimetableSlot {
  period_id?: number | null;
  id: number;
  school_id: number;
  class_id: number;
  subject_id: number;
  teacher_user_id: number | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  class_name: string;
  subject_name: string;
  teacher_name: string | null;
}

export interface MyTimetableSlot {
  id: number;
  class_id: number;
  subject_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  class_name: string;
  subject_name: string;
}

export interface StaffAttendanceRecord {
  id: number;
  school_id: number;
  user_id: number;
  date: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  note: string | null;
}

export interface StaffAttendanceWithName extends StaffAttendanceRecord {
  staff_name: string;
}

export type StaffDayStatus = "present" | "late" | "absent" | "on_leave" | "expected";

export interface StaffDayRow {
  user_id: number;
  name: string;
  role: string;
  status: StaffDayStatus;
  source: string | null;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  leave_type: string | null;
  reason: string | null;
  note: string | null;
  lessons: number;
  register_status: "self" | "other" | "missing" | null;
}

export interface StaffDay {
  date: string;
  school_day: boolean;
  holiday: string | null;
  rows: StaffDayRow[];
}

export interface StaffSummaryRow {
  user_id: number;
  name: string;
  role: string;
  school_days: number;
  present: number;
  late: number;
  absent_explained: number;
  absent_unexplained: number;
  on_leave: number;
}

export interface StaffSummary {
  date_from: string;
  date_to: string;
  school_days: number;
  rows: StaffSummaryRow[];
}

export interface StaffLeave {
  id: number;
  user_id: number;
  staff_name: string;
  start_date: string;
  end_date: string;
  leave_type: string;
  note: string | null;
  recorded_by_name: string | null;
}

export interface StaffPerson {
  user_id: number;
  name: string;
  role: string;
  tracked: boolean;
}

export interface DutyAssignment {
  id: number;
  school_id: number;
  user_id: number;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  assigned_by: number | null;
}

export interface DutyAssignmentWithName extends DutyAssignment {
  staff_name: string;
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
  vehicle_type?: string;
  make_model?: string | null;
  insurance_expiry?: string | null;
  inspection_expiry?: string | null;
  next_service_date?: string | null;
  attendant_user_id?: number | null;
  attendant_name?: string | null;
  notes?: string | null;
  assigned_learners?: number;
}

export interface RunSummary {
  route_id: number;
  route_name: string;
  direction: "morning" | "afternoon";
  vehicle_registration: string | null;
  driver_name: string | null;
  attendant_name: string | null;
  run_id: number | null;
  status: "not_started" | "in_progress" | "completed";
  expected: number;
  pending: number;
  boarded: number;
  dropped: number;
  absent: number;
  started_at: string | null;
  completed_at: string | null;
  due_time: string | null;
}

export interface ManifestRow {
  student_id: number;
  name: string;
  class_name: string | null;
  admission_number: string;
  stop_name: string | null;
  stop_time: string | null;
  guardian_phone: string | null;
  status: "pending" | "boarded" | "dropped" | "absent";
  boarded_at: string | null;
  dropped_at: string | null;
  handed_to: string | null;
  note: string | null;
}

export interface RunDetail {
  summary: RunSummary;
  rows: ManifestRow[];
}

export interface TransportEvent {
  at: string;
  by: string;
  via: "bus" | "gate" | "parent";
  note: string | null;
}

export interface TransportLearner {
  student_id: number;
  name: string;
  admission_number: string;
  bus_rider: boolean;
  arrival: TransportEvent | null;
  departure: TransportEvent | null;
  on_route: TransportEvent[];
}

export interface TransportClassRow {
  class_id: number;
  class_name: string;
  level: string;
  learners: number;
  arrived: number;
  left: number;
  bus_riders: number;
  rows: TransportLearner[];
}

export interface TransportOverview {
  date: string;
  school_day: boolean;
  summary: { learners: number; arrived: number; left: number; bus_riders: number; runs_total: number; runs_completed: number; runs_in_progress: number };
  runs: RunSummary[];
  fleet_alerts: { vehicle: string; text: string; urgent: boolean }[];
  classes: TransportClassRow[];
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
  school_arrival_time?: string | null;
  afternoon_departure_time?: string | null;
  learners?: number;
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
  created_by: number | null;
  created_by_name: string | null;
  scope: "school" | "class" | "invited";
  class_id: number | null;
  class_name: string | null;
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
  exam_type: string;
  term: string;
  duration_minutes: number;
  is_published: boolean;
  opens_at: string | null;
  closes_at: string | null;
  paper_file_url: string | null;
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
  class_position: string | null;
  attendance_rate: number | null;
  class_teacher_remark: string | null;
  principal_remark: string | null;
  competency_assessments: CompetencyAssessment[];
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

export type ExpenseStatus = "pending" | "approved" | "rejected";

export interface Expense {
  id: number;
  school_id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: ExpenseStatus;
  recorded_by: number | null;
  approved_by: number | null;
  approved_at: string | null;
  rejected_reason: string | null;
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

export interface InsightsFigure {
  value: number | null;
  previous: number | null;
}

export interface Insights {
  term: string;
  start_date: string | null;
  end_date: string | null;
  scorecard: {
    average: InsightsFigure;
    attendance_rate: InsightsFigure;
    coverage: { completed: number; total: number; expected: number | null };
    below_expectation: number | null;
    below_expectation_previous: number | null;
    learners: number;
    previous_term: string | null;
  };
  attention: {
    dropped_learners: { student_id: number; name: string; class_name: string; average: number; previous: number; drop: number }[];
    absence_streaks: { student_id: number; name: string; class_name: string; days: number; since: string }[];
    weak_subjects: { class_id: number; class_name: string; subject_id: number; subject_name: string; average: number; previous: number | null; learners: number }[];
    behind_teachers: { teacher_name: string; class_name: string; subject_name: string; plan_id: number | null; completed: number; expected: number; behind: number }[];
    meeting_line: number | null;
  };
  exam_types: { exam_type: string; average: number; count: number }[];
  classes: { class_id: number; class_name: string; average: number; count: number }[];
  school_average: number | null;
  levels: { subject_id: number; subject: string; counts: Record<string, number>; total: number }[];
  bands: { level_code: string; label: string; min_score: number; max_score: number }[];
  attendance: {
    calendar: { date: string; rate: number; marked: number }[];
    reasons: { reason: string; count: number }[];
    without_reason: number;
    scatter: { attendance: number; average: number }[];
    correlation: number | null;
  };
  delivery: { taught: number; partly: number; not_taught: number; reasons: Record<string, number> };
}

export type AwardScope = "student" | "staff" | "class" | "school";

export interface ClassCard {
  id: number;
  name: string;
  grade_code: string | null;
  grade_name: string | null;
  level: string;
  homeroom_teacher_id: number | null;
  homeroom_teacher_name: string | null;
  learners: number;
  teachers: number;
  subjects: number;
  register_today: "taken" | "missing" | "not_a_school_day";
  attendance_rate: number | null;
  attendance_date: string | null;
  average: number | null;
  topics_covered: number;
  topics_total: number;
  homework_this_week: number;
  open_conduct: number;
}

export interface ClassDetail {
  card: ClassCard;
  term: string | null;
  teacher_rows: { subject_id: number; subject: string; teacher_id: number | null; teacher: string | null; topics_covered: number; topics_total: number; homework_this_week: number; last_taught: string | null }[];
  learners_list: { id: number; name: string; admission_number: string; attendance_rate: number | null; average: number | null }[];
  attendance_days: { date: string; rate: number; marked: number }[];
  subject_averages: { subject: string; average: number }[];
  homework: { id: number; title: string; subject: string; due_date: string; given_on_board: boolean; teacher: string | null }[];
  conduct: { id: number; student_name: string; category: string; status: string; incident_date: string }[];
  boys: number;
  girls: number;
}

export interface TeacherCard {
  user_id: number;
  name: string;
  email: string;
  phone: string | null;
  staff_number: string | null;
  tsc_number: string | null;
  department: string | null;
  categories: string[];
  classes: string[];
  class_teacher_of: string[];
  subjects: string[];
  today: StaffDayStatus | null;
  topics_covered: number;
  topics_total: number;
  topics_expected: number | null;
  lessons_marked_week: number;
  lessons_scheduled_week: number;
  homework_week: number;
  plans: number;
}

export interface HomeworkGrid {
  week_start: string;
  days: string[];
  rows: { class_id: number; class_name: string; subject_id: number; subject: string; teacher: string | null; cells: { date: string; status: "given" | "board" | "none" | "missing" | "upcoming" | "no_lesson"; count: number; titles: string[] }[] }[];
  summary: { given: number; board: number; none: number; missing: number; expected: number };
}

export interface ActivityEvent {
  kind: string;
  label: string;
  at: string;
  title: string;
  detail: string;
  actor: string | null;
  href: string;
}

export interface ActivityFeed {
  start: string;
  end: string;
  total: number;
  counts: Record<string, number>;
  events: ActivityEvent[];
}

export interface AttendanceOversight {
  date: string;
  school_day: boolean;
  holiday: string | null;
  classes_total: number;
  classes_taken: number;
  school_rate: number | null;
  learners_marked: number;
  rows: {
    class_id: number;
    class_name: string;
    level: string;
    learners: number;
    register_status: "taken" | "missing" | "not_a_school_day";
    taken_by: string | null;
    present: number;
    late: number;
    excused: number;
    absent: number;
    rate: number | null;
    absentees: { name: string; status: string; reason: string | null }[];
  }[];
}

export interface PulseTile { label: string; value: string; hint: string | null; tone: "neutral" | "good" | "warn" | "bad" }
export interface PulseAttention { text: string; tone: "warn" | "bad" | "good"; href: string | null }
export interface PulseSection { key: string; title: string; href: string; summary: string; tiles: PulseTile[]; attention: PulseAttention[] }
export interface WeeklyReport { school_name: string; term: string | null; week_start: string; week_end: string; headline: string; attention_count: number; sections: PulseSection[] }

export interface LeadershipFeedback {
  id: number;
  recipient_user_id: number;
  recipient_name: string;
  author_name: string | null;
  topic: string;
  link: string | null;
  message: string;
  status: "sent" | "acknowledged";
  reply: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export interface HeadOverview {
  pulse: {
    school_day: boolean;
    holiday: string | null;
    learners: number;
    teachers: number;
    classes: number;
    attendance_rate: number | null;
    registers_taken: number;
    registers_total: number;
    staff_present: number;
    staff_late: number;
    staff_absent: number;
    staff_on_leave: number;
    staff_expected: number;
    lessons_scheduled: number;
    lessons_marked: number;
    unmarked_yesterday: number;
    start: string | null;
    end: string | null;
    is_range: boolean;
    school_days: number;
    lessons_unmarked: number;
    homework_recorded: number;
    homework_expected: number;
    homework_missing: number;
    fees_collected: number;
    missing_registers: { class_name: string; teacher: string | null; days: number }[];
  };
  inbox: { kind: string; title: string; detail: string; age_days: number; href: string }[];
  inbox_counts: Record<string, number>;
}

export interface Award {
  id: number;
  school_id: number;
  scope: AwardScope;
  student_id: number | null;
  staff_user_id: number | null;
  class_id: number | null;
  subject_id: number | null;
  activity_id: number | null;
  recipient_name: string;
  class_name: string | null;
  subject_name: string | null;
  title: string;
  description: string | null;
  category: string | null;
  term: string | null;
  date_awarded: string;
  awarded_by: number | null;
  awarded_by_name: string | null;
  created_at: string;
}

export type ConductCategory = "disruption" | "disrespect" | "bullying" | "fighting" | "dishonesty" | "property_damage" | "dress_code" | "other";
export type ConductStatus = "open" | "reviewed";

export interface ConductReport {
  id: number;
  school_id: number;
  student_id: number;
  class_id: number | null;
  reported_by: number;
  reported_by_name: string;
  category: ConductCategory;
  description: string;
  action_taken: string | null;
  incident_date: string;
  status: ConductStatus;
  response: string | null;
  responded_by: number | null;
  responded_at: string | null;
  created_at: string;
  student_name: string;
}

export type LeadStage = "enquiry" | "visit_booked" | "applied" | "offer_sent" | "enrolled" | "lost";

export interface Lead {
  id: number;
  school_id: number;
  child_name: string;
  grade_interested: string | null;
  guardian_name: string;
  guardian_phone: string | null;
  guardian_email: string | null;
  source: string | null;
  stage: LeadStage;
  notes: string | null;
  student_id: number | null;
  created_at: string;
  updated_at: string;
}

export type CalendarEventType = "meeting" | "exam" | "sports" | "admissions" | "holiday" | "term" | "trip_briefing" | "college" | "other";

export interface CalendarEvent {
  id: number;
  school_id: number;
  title: string;
  event_type: CalendarEventType;
  start_date: string;
  end_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceTrendPoint {
  date: string;
  rate: number | null;
}

export interface PendingRegister {
  class_id: number;
  class_name: string;
  teacher_name: string | null;
  student_count: number;
}

export interface TopBalance {
  student_id: number;
  student_name: string;
  admission_number: string;
  class_name: string | null;
  balance: number;
}

export interface RecentActivityItem {
  action: string;
  entity_type: string;
  entity_id: number;
  created_at: string;
  actor_name: string | null;
}

export interface DashboardSummary {
  total_students: number;
  total_staff: number;
  active_staff: number;
  amount_billed: number;
  amount_paid: number;
  fee_collection_rate: number;
  today_attendance_rate: number | null;
  yesterday_attendance_rate: number | null;
  attendance_trend: AttendanceTrendPoint[];
  classes_total: number;
  classes_marked_today: number;
  pending_registers: PendingRegister[];
  top_balances: TopBalance[];
  recent_activity: RecentActivityItem[];
}

export interface GroupBranchSummary {
  school_id: number;
  name: string;
  is_group: boolean;
  total_students: number;
  active_staff: number;
  amount_billed: number;
  amount_paid: number;
  fee_collection_rate: number;
  today_attendance_rate: number | null;
  classes_total: number;
  classes_marked_today: number;
}

export interface GroupSummary {
  group_id: number;
  group_name: string;
  rows: GroupBranchSummary[];
  total_students: number;
  total_active_staff: number;
  total_amount_billed: number;
  total_amount_paid: number;
  overall_fee_collection_rate: number;
}

export interface LinkedSchool {
  id: number;
  name: string;
}

export interface Supervisor {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  schools: LinkedSchool[];
}

export interface SupervisorOverview {
  schools: GroupBranchSummary[];
  total_students: number;
  total_active_staff: number;
}

export interface MealMenuEntry {
  id: number;
  school_id: number;
  date: string;
  meal_type: "breakfast" | "lunch" | "snack";
  description: string;
}

// --- Boarding ---

export interface BoardingHouse {
  id: number;
  school_id: number;
  name: string;
  gender: string;
  total_beds: number;
  occupied_beds: number;
}

export interface BoardingAssignment {
  id: number;
  student_id: number;
  house_id: number;
  bed_number: string;
  assigned_at: string;
}

export type RollSession = "morning" | "evening" | "night";

export interface RollCall {
  id: number;
  house_id: number;
  date: string;
  session: RollSession;
  marks: Record<string, "P" | "A" | "S">;
  created_at: string;
  updated_at: string;
}

export type ExeatStatus = "pending" | "approved" | "denied" | "out" | "returned" | "returned_late";

export interface Exeat {
  id: number;
  student_id: number;
  from_date: string;
  to_date: string;
  reason: string;
  detail: string | null;
  pickup_name: string;
  pickup_relation: string | null;
  pickup_phone: string | null;
  status: ExeatStatus;
  gate_pass: string | null;
  out_at: string | null;
  back_at: string | null;
  created_at: string;
}

export type SickBayAction = "rest_in_sick_bay" | "refer_to_clinic" | "first_aid";

export interface SickBayVisit {
  id: number;
  student_id: number;
  complaint: string;
  temperature: number | null;
  action: SickBayAction;
  status: string;
  parent_notified: boolean;
  created_at: string;
}

export type IncidentStatus = "open" | "closed";

export interface BoardingIncident {
  id: number;
  house_id: number;
  type: string;
  description: string;
  action_taken: string;
  status: IncidentStatus;
  created_at: string;
}

// --- Security ---

export interface Visitor {
  id: number;
  badge: string;
  name: string;
  id_number_masked: string;
  phone: string;
  purpose: string;
  host_name: string;
  vehicle_registration: string | null;
  signed_in_at: string;
  signed_out_at: string | null;
}

export type VehicleDirection = "in" | "out";

export interface VehicleLogEntry {
  id: number;
  registration: string;
  direction: VehicleDirection;
  driver_name: string;
  purpose: string;
  logged_at: string;
}

export type VehicleReleaseStatus = "pending" | "approved" | "rejected";

export interface VehicleReleaseRequest {
  id: number;
  registration: string;
  driver_name: string;
  purpose: string;
  status: VehicleReleaseStatus;
  decision_note: string | null;
  requested_by: number | null;
  requested_at: string;
  decided_by: number | null;
  decided_at: string | null;
}

export interface EarlyPickup {
  id: number;
  student_id: number;
  collected_by: string;
  relation: string;
  reason: string;
  verified: boolean;
  note: string | null;
  created_at: string;
}

export type IncidentSeverity = "low" | "medium" | "high";
export type SecurityIncidentStatus = "open" | "closed";

export interface SecurityIncident {
  id: number;
  type: string;
  location: string;
  severity: IncidentSeverity;
  description: string;
  action_taken: string;
  status: SecurityIncidentStatus;
  created_at: string;
}

export interface SecurityAlert {
  id: number;
  type: string;
  message: string;
  active: boolean;
  sms_parents: boolean;
  created_at: string;
}

export interface PatrolLogEntry {
  id: number;
  post: string;
  ok: boolean;
  note: string;
  created_at: string;
}

// --- Ledger / ERP finance ---

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export interface LedgerAccount {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  balance: number;
}

export interface JournalLine {
  id: number;
  account_id: number;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: number;
  entry_date: string;
  reference: string;
  memo: string;
  source: string;
  created_at: string;
  lines: JournalLine[];
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  type: AccountType;
  debit: number;
  credit: number;
}

export interface IncomeStatement {
  income_total: number;
  expense_total: number;
  surplus: number;
  income_lines: TrialBalanceRow[];
  expense_lines: TrialBalanceRow[];
}

export interface BalanceSheet {
  assets_total: number;
  liabilities_total: number;
  equity_total: number;
  period_surplus: number;
  asset_lines: TrialBalanceRow[];
  liability_lines: TrialBalanceRow[];
  equity_lines: TrialBalanceRow[];
}

// --- Fixed assets ---

export type AssetStatus = "active" | "disposed";

export interface FixedAsset {
  id: number;
  code: string;
  name: string;
  account_id: number;
  acquisition_date: string;
  cost: number;
  residual_value: number;
  useful_life_years: number;
  accumulated_depreciation: number;
  net_book_value: number;
  status: AssetStatus;
}

export interface DepreciationRun {
  id: number;
  period: string;
  total_amount: number;
  created_at: string;
}

// --- Payroll ---

export type EmploymentType = "teaching" | "non_teaching";

export interface PayrollProfile {
  id: number;
  user_id: number;
  staff_name: string;
  employment_type: EmploymentType;
  basic_salary: number;
  house_allowance: number;
  transport_allowance: number;
  kra_pin: string;
  nssf_number: string;
  is_active: boolean;
}

export type PayRunStatus = "draft" | "paid";

export interface PayslipLine {
  id: number;
  user_id: number;
  staff_name: string;
  employment_type: EmploymentType;
  basic: number;
  house: number;
  transport: number;
  gross: number;
  nssf: number;
  shif: number;
  ahl: number;
  paye: number;
  net: number;
}

export interface PayRun {
  id: number;
  period: string;
  status: PayRunStatus;
  created_at: string;
  lines: PayslipLine[];
}

// --- Stores ---

export interface StockItem {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  reorder_level: number;
  unit_cost: number;
  account_id: number;
}

export type StockMovementType = "receipt" | "issue" | "adjustment";

export interface StoreRequestLine {
  id: number;
  item_id: number;
  item_name: string;
  unit: string;
  in_stock: number;
  quantity_requested: number;
  quantity_issued: number;
}

export interface StoreRequest {
  id: number;
  reference: string;
  department: string;
  note: string | null;
  status: "requested" | "issued" | "declined";
  requested_by_name: string | null;
  requested_at: string;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  lines: StoreRequestLine[];
}

export interface FinanceActivity {
  start: string;
  end: string;
  people: { user_id: number; name: string; role: string; actions: number; amount: number; by_kind: Record<string, number> }[];
  events: { at: string; actor: string | null; role: string | null; kind: string; title: string; detail: string; amount: number | null; href: string }[];
  totals: Record<string, number>;
}

export interface StockMovement {
  id: number;
  item_id: number;
  type: StockMovementType;
  quantity: number;
  department: string | null;
  note: string | null;
  created_at: string;
}

// --- Budgets ---

export interface BudgetLine {
  account_id: number;
  account_code: string;
  account_name: string;
  year: number;
  budget: number;
  actual: number;
  committed: number;
  available: number;
}

// --- Procurement ---

export type RequisitionStatus = "submitted" | "approved" | "declined";

export interface Requisition {
  id: number;
  reference: string;
  department: string;
  account_id: number;
  description: string;
  quantity: number;
  unit_cost: number;
  total: number;
  status: RequisitionStatus;
  created_at: string;
}

export type PurchaseOrderStatus = "issued" | "received" | "cancelled";

export interface PurchaseOrder {
  id: number;
  reference: string;
  requisition_id: number;
  supplier_id: number;
  delivery_date: string;
  total: number;
  status: PurchaseOrderStatus;
  created_at: string;
}

// --- Suppliers ---

export interface Supplier {
  id: number;
  name: string;
  kra_pin: string;
  category: string;
  phone: string;
  email: string;
  bank_account: string | null;
  etims_registered: boolean;
  is_active: boolean;
  since: string;
  created_at: string;
}

// --- Trips ---

export type TripStatus = "requested" | "approved" | "in_progress" | "completed" | "declined" | "cancelled";

export interface Complaint {
  id: number;
  school_id: number;
  raised_by: number;
  raised_by_name: string;
  raised_by_role: string;
  audience: "class_teacher" | "principal";
  class_id: number | null;
  subject: string;
  message: string;
  status: "open" | "resolved";
  response: string | null;
  responded_by: number | null;
  responded_at: string | null;
  created_at: string;
}

export interface Trip {
  id: number;
  reference: string;
  title: string;
  trip_type: string;
  purpose: string;
  destination: string;
  start_date: string;
  end_date: string;
  departure_time: string;
  return_time: string;
  class_ids: number[];
  student_ids: number[];
  staff_count: number;
  distance_km: number;
  estimated_cost: number;
  vehicle_id: number | null;
  status: TripStatus;
  created_at: string;
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

export type LessonPlanEntryStatus = "planned" | "completed";

export interface LessonPlanEntry {
  id: number;
  order: number;
  label: string;
  scheduled_date: string | null;
  topic: string;
  objectives: string | null;
  resources: string | null;
  notes: string | null;
  status: LessonPlanEntryStatus;
}

export interface LessonPlan {
  id: number;
  school_id: number;
  class_id: number;
  subject_id: number;
  term: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  entry_count: number;
  completed_count: number;
  next_topic: string | null;
}

export interface LessonPlanDetail extends LessonPlan {
  entries: LessonPlanEntry[];
}

export type DeliveryStatus = "taught" | "partly" | "not_taught";
export type NotTaughtReason = "teacher_absent" | "public_holiday" | "exams" | "school_event" | "other";

export interface LessonDelivery {
  id: number;
  entry_id: number | null;
  status: DeliveryStatus;
  reason: string | null;
  remark: string | null;
  topic: string | null;
}

export interface DayLesson {
  slot_id: number;
  class_id: number;
  class_name: string;
  subject_id: number;
  subject_name: string;
  start_time: string;
  end_time: string;
  room: string | null;
  plan: { plan_id: number; term: string; entry_count: number; completed_count: number } | null;
  entry: LessonPlanEntry | null;
  delivery: LessonDelivery | null;
}

export interface LessonDay {
  date: string;
  is_today: boolean;
  holiday: string | null;
  lessons: DayLesson[];
}

export interface RecordOfWorkRow {
  id: number;
  lesson_date: string;
  start_time: string;
  end_time: string;
  teacher_user_id: number;
  teacher_name: string;
  class_name: string;
  subject_name: string;
  topic: string | null;
  status: DeliveryStatus;
  reason: string | null;
  remark: string | null;
}

export interface CoverageRow {
  teacher_user_id: number | null;
  teacher_name: string;
  class_id: number;
  class_name: string;
  subject_id: number;
  subject_name: string;
  plan_id: number | null;
  entry_count: number;
  completed_count: number;
  expected_covered: number | null;
  taught: number;
  partly: number;
  not_taught: number;
  reasons: Record<string, number>;
  last_taught: string | null;
}

export interface Coverage {
  term: string;
  start_date: string | null;
  end_date: string | null;
  rows: CoverageRow[];
}

export type HomeworkSubmissionStatus = "not_submitted" | "submitted" | "reviewed";

export interface Homework {
  id: number;
  school_id: number;
  class_id: number;
  subject_id: number;
  title: string;
  homework_type: string;
  instructions: string | null;
  attachment_url: string | null;
  due_date: string;
  allow_digital_submission: boolean;
  given_on_board?: boolean;
  created_by: number | null;
  created_at: string;
}

export interface HomeworkListItem extends Homework {
  created_by_name: string | null;
  total_students: number;
  submitted_count: number;
  reviewed_count: number;
}

export interface HomeworkSubmissionRow {
  student_id: number;
  student_name: string;
  status: HomeworkSubmissionStatus;
  file_url: string | null;
  submitted_at: string | null;
  score: number | null;
  teacher_comment: string | null;
  reviewed_at: string | null;
}

export interface HomeworkDetail extends HomeworkListItem {
  submissions: HomeworkSubmissionRow[];
}

export interface HomeworkForStudent {
  id: number;
  subject_name: string;
  title: string;
  instructions: string | null;
  attachment_url: string | null;
  due_date: string;
  allow_digital_submission: boolean;
  status: HomeworkSubmissionStatus;
  file_url: string | null;
  score: number | null;
  teacher_comment: string | null;
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

  getSchoolBranding: (token: string, schoolId: number) =>
    request<{ name: string; slug: string; logo_url: string | null; primary_color: string; secondary_color: string }>(
      `/schools/${schoolId}/branding`,
      {},
      token
    ),

  listSchools: (token: string) => request<School[]>("/schools", {}, token),

  getPlatformOverview: (token: string) =>
    request<PlatformOverview>("/schools/platform-overview", {}, token),

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

  updateSubscription: (
    token: string,
    schoolId: number,
    payload: Partial<{ plan_id: number | null; subscription_status: string; trial_ends_at: string }>
  ) =>
    request<School>(
      `/schools/${schoolId}/subscription`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listPlans: (token: string) => request<Plan[]>("/plans", {}, token),

  createPlan: (
    token: string,
    payload: { name: string; price: number; currency: string; billing_period: "monthly" | "annual"; max_students?: number }
  ) => request<Plan>("/plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, token),

  updatePlan: (token: string, planId: number, payload: Partial<{ is_active: boolean }>) =>
    request<Plan>(`/plans/${planId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, token),

  listBranches: (token: string, schoolId: number) => request<School[]>(`/schools/${schoolId}/branches`, {}, token),

  updateBranding: (
    token: string,
    schoolId: number,
    payload: Partial<{
      name: string;
      logo_url: string;
      primary_color: string;
      secondary_color: string;
      custom_domain: string;
      expense_approval_threshold: number;
    }>
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

  demoDataStatus: (token: string, schoolId: number) =>
    request<{ has_demo_data: boolean; state: "idle" | "running" | "done" | "error"; error: string | null; result: { classes: number; students: number; staff: number; teacher_login: { email: string; password: string } } | null }>(`/schools/${schoolId}/demo-data`, {}, token),

  generateDemoData: (token: string, schoolId: number) =>
    request<{ started: boolean }>(`/schools/${schoolId}/demo-data`, { method: "POST" }, token),

  deleteDemoData: (token: string, schoolId: number) =>
    request<Record<string, number>>(
      `/schools/${schoolId}/demo-data`,
      { method: "DELETE" },
      token
    ),

  triggerWeeklyReports: (token: string) =>
    request<{ schools_processed: number; branch_reports_sent: number; group_reports_sent: number }>(
      `/schools/weekly-reports/send`,
      { method: "POST" },
      token
    ),

  listClasses: (token: string, schoolId: number) =>
    request<SchoolClass[]>(`/schools/${schoolId}/classes`, {}, token),

  createClass: (token: string, schoolId: number, payload: { name: string; grade_level_id?: number | null }) =>
    request<SchoolClass>(
      `/schools/${schoolId}/classes`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  updateClass: (
    token: string,
    schoolId: number,
    classId: number,
    payload: { name?: string; grade_level_id?: number | null; homeroom_teacher_id?: number | null }
  ) =>
    request<SchoolClass>(
      `/schools/${schoolId}/classes/${classId}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listGradeLevels: (token: string) => request<GradeLevel[]>("/grade-levels", {}, token),

  listEnabledGrades: (token: string, schoolId: number) =>
    request<GradeLevel[]>(`/schools/${schoolId}/enabled-grades`, {}, token),

  setEnabledGrades: (token: string, schoolId: number, gradeLevelIds: number[]) =>
    request<GradeLevel[]>(
      `/schools/${schoolId}/enabled-grades`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grade_level_ids: gradeLevelIds }) },
      token
    ),

  seedPrePrimaryLearningAreas: (token: string, schoolId: number) =>
    request<Subject[]>(`/schools/${schoolId}/subjects/seed-pre-primary-learning-areas`, { method: "POST" }, token),

  listCompetencyAssessments: (token: string, schoolId: number, studentId: number) =>
    request<CompetencyAssessment[]>(`/schools/${schoolId}/competency-assessments?student_id=${studentId}`, {}, token),

  createCompetencyAssessment: (
    token: string,
    schoolId: number,
    payload: {
      student_id: number; class_id: number; subject_id: number; term: string;
      strand: string; sub_strand?: string; criterion: string;
      performance_level: PerformanceLevel; assessment_date: string;
      teacher_comment?: string; follow_up_action?: string;
    }
  ) =>
    request<CompetencyAssessment>(
      `/schools/${schoolId}/competency-assessments`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listObservationNotes: (token: string, schoolId: number, studentId: number) =>
    request<ObservationNote[]>(`/schools/${schoolId}/observation-notes?student_id=${studentId}`, {}, token),

  createObservationNote: (
    token: string,
    schoolId: number,
    payload: { student_id: number; class_id: number; subject_id?: number; strand?: string; note: string; noted_on: string }
  ) =>
    request<ObservationNote>(
      `/schools/${schoolId}/observation-notes`,
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

  updateStudent: (token: string, schoolId: number, studentId: number, body: Partial<Student>) =>
    request<Student>(`/schools/${schoolId}/students/${studentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  getExamReadiness: (token: string, schoolId: number) => request<ExamReadiness>(`/schools/${schoolId}/oversight/exam-readiness`, {}, token),
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
      role: "teacher" | "staff" | "security" | "boarding_staff" | "transport_staff" | "transport_attendant" | "librarian" | "store_keeper" | "accountant" | "procurement_officer" | "bursar" | "secretary";
      staff_number: string;
      department?: string;
      phone?: string;
      tsc_number?: string;
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

  listAttendanceHistory: (token: string, schoolId: number, dateFrom: string, dateTo: string, classId?: number) => {
    const qs = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    if (classId != null) qs.set("class_id", String(classId));
    return request<AttendanceRecord[]>(`/schools/${schoolId}/attendance?${qs}`, {}, token);
  },

  markAttendance: (
    token: string,
    schoolId: number,
    payload: { class_id: number; date: string; records: { student_id: number; status: AttendanceStatus; reason?: string }[] }
  ) =>
    request<AttendanceRecord[]>(
      `/schools/${schoolId}/attendance`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  // --- Results ---

  listSubjects: (token: string, schoolId: number) => request<Subject[]>(`/schools/${schoolId}/subjects`, {}, token),

  updateSubject: (token: string, schoolId: number, id: number, body: { name?: string; grade_level_ids?: number[] }) =>
    request<Subject>(`/schools/${schoolId}/subjects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  deleteSubject: (token: string, schoolId: number, id: number) => request<void>(`/schools/${schoolId}/subjects/${id}`, { method: "DELETE" }, token),
  getPerformance: (token: string, schoolId: number, q: { term?: string; exam_types?: string[] } = {}) => {
    const p = new URLSearchParams();
    if (q.term) p.set("term", q.term);
    if (q.exam_types?.length) p.set("exam_types", q.exam_types.join(","));
    return request<PerformanceOverview>(`/schools/${schoolId}/oversight/performance?${p}`, {}, token);
  },
  listClassTeachers: (token: string, schoolId: number) => request<ClassTeacherRow[]>(`/schools/${schoolId}/teacher-assignments/class-teachers`, {}, token),
  setClassTeacher: (token: string, schoolId: number, classId: number, teacherId: number | null, replace = false) =>
    request<ClassTeacherRow>(`/schools/${schoolId}/teacher-assignments/class-teachers/${classId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacher_user_id: teacherId, replace }) }, token),
  createSubject: (token: string, schoolId: number, name: string, gradeLevelIds: number[] = []) =>
    request<Subject>(
      `/schools/${schoolId}/subjects`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, grade_level_ids: gradeLevelIds }) },
      token
    ),

  listResults: (token: string, schoolId: number, params: { student_id?: number; subject_id?: number; term?: string; exam_type?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return request<Result[]>(`/schools/${schoolId}/results${qs ? `?${qs}` : ""}`, {}, token);
  },

  getReportCard: (token: string, schoolId: number, studentId: number, term: string, examTypes: string[] = []) =>
    request<ReportCard>(
      `/schools/${schoolId}/students/${studentId}/report-card?term=${encodeURIComponent(term)}${examTypes.length ? `&exam_types=${encodeURIComponent(examTypes.join(","))}` : ""}`,
      {},
      token
    ),

  listClassSubjects: (token: string, schoolId: number, classId: number) =>
    request<Subject[]>(`/schools/${schoolId}/classes/${classId}/subjects`, {}, token),

  getResultsBoard: (token: string, schoolId: number, classId: number, term: string, examTypes: string[] = []) =>
    request<ResultsBoard>(
      `/schools/${schoolId}/classes/${classId}/results-board?term=${encodeURIComponent(term)}${examTypes.length ? `&exam_types=${encodeURIComponent(examTypes.join(","))}` : ""}`,
      {},
      token
    ),

  getChildReportCard: (token: string, studentId: number, term: string) =>
    request<ReportCard>(`/portal/students/${studentId}/report-card?term=${encodeURIComponent(term)}`, {}, token),

  updateReportCardRemarks: (
    token: string,
    schoolId: number,
    studentId: number,
    term: string,
    payload: { class_teacher_remark?: string; principal_remark?: string }
  ) =>
    request<ReportCard>(
      `/schools/${schoolId}/students/${studentId}/report-card-remarks?term=${encodeURIComponent(term)}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  getResultsAnalytics: (token: string, schoolId: number, term?: string) =>
    request<ResultsAnalytics>(`/schools/${schoolId}/analytics/results${term ? `?term=${encodeURIComponent(term)}` : ""}`, {}, token),

  getClassCards: (token: string, schoolId: number) => request<ClassCard[]>(`/schools/${schoolId}/oversight/classes`, {}, token),
  getClassDetail: (token: string, schoolId: number, classId: number) => request<ClassDetail>(`/schools/${schoolId}/oversight/classes/${classId}`, {}, token),
  getTeacherCards: (token: string, schoolId: number) => request<TeacherCard[]>(`/schools/${schoolId}/oversight/teachers`, {}, token),
  getHomeworkGrid: (token: string, schoolId: number, week?: string) => request<HomeworkGrid>(`/schools/${schoolId}/oversight/homework${week ? `?week=${week}` : ""}`, {}, token),
  getAttendanceOversight: (token: string, schoolId: number, on?: string) => request<AttendanceOversight>(`/schools/${schoolId}/oversight/attendance${on ? `?on=${on}` : ""}`, {}, token),
  overrideMark: (token: string, schoolId: number, body: { student_id: number; subject_id: number; term: string; exam_type: string; score: number; reason: string }) =>
    request<{ score: number; grade: string | null }>(`/schools/${schoolId}/oversight/overrides/mark`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),

  getPulse: (token: string, schoolId: number, key: string) => request<PulseSection>(`/schools/${schoolId}/oversight/pulse/${key}`, {}, token),
  getWeeklyReport: (token: string, schoolId: number) => request<WeeklyReport>(`/schools/${schoolId}/oversight/weekly-report`, {}, token),
  emailWeeklyReport: (token: string, schoolId: number) => request<{ sent: boolean }>(`/schools/${schoolId}/oversight/weekly-report/email-me`, { method: "POST" }, token),

  listFeedback: (token: string, schoolId: number, recipientUserId?: number) =>
    request<LeadershipFeedback[]>(`/schools/${schoolId}/feedback${recipientUserId ? `?recipient_user_id=${recipientUserId}` : ""}`, {}, token),
  sendFeedback: (token: string, schoolId: number, body: { recipient_user_id: number; topic: string; link?: string; message: string }) =>
    request<LeadershipFeedback>(`/schools/${schoolId}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  acknowledgeFeedback: (token: string, schoolId: number, id: number, reply?: string) =>
    request<LeadershipFeedback>(`/schools/${schoolId}/feedback/${id}/acknowledge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply: reply || null }) }, token),

  getSchoolActivity: (token: string, schoolId: number, q: { start: string; end?: string; kinds?: string[] }) => {
    const p = new URLSearchParams({ start: q.start });
    if (q.end) p.set("end", q.end);
    if (q.kinds?.length) p.set("kinds", q.kinds.join(","));
    return request<ActivityFeed>(`/schools/${schoolId}/oversight/activity?${p}`, {}, token);
  },
  getHeadOverview: (token: string, schoolId: number, range?: { start: string; end: string }) =>
    request<HeadOverview>(`/schools/${schoolId}/oversight/overview${range ? `?start=${range.start}&end=${range.end}` : ""}`, {}, token),

  addStreams: (token: string, schoolId: number, gradeLevelId: number, streams: string[]) =>
    request<{ created: string[]; skipped: string[] }>(
      `/schools/${schoolId}/classes/streams`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ grade_level_id: gradeLevelId, streams }) },
      token
    ),

  declareNoHomework: (token: string, schoolId: number, classId: number, subjectId: number) =>
    request<void>(
      `/schools/${schoolId}/homework/none`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ class_id: classId, subject_id: subjectId }) },
      token
    ),

  getInsights: (token: string, schoolId: number, params: { term: string; class_id?: number; subject_id?: number }) => {
    const qs = new URLSearchParams({ term: params.term });
    if (params.class_id !== undefined) qs.set("class_id", String(params.class_id));
    if (params.subject_id !== undefined) qs.set("subject_id", String(params.subject_id));
    return request<Insights>(`/schools/${schoolId}/analytics/insights?${qs}`, {}, token);
  },

  getAttendanceTrend: (token: string, schoolId: number) =>
    request<AttendanceTrendPoint[]>(`/schools/${schoolId}/analytics/attendance-trend`, {}, token),

  // --- Exams ---

  listExams: (token: string, schoolId: number) => request<Exam[]>(`/schools/${schoolId}/exams`, {}, token),

  createExam: (
    token: string,
    schoolId: number,
    payload: {
      subject_id: number;
      class_id?: number;
      title: string;
      exam_type?: string;
      term: string;
      duration_minutes?: number;
      opens_at?: string;
      closes_at?: string;
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

  uploadExamPaper: (token: string, schoolId: number, examId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Exam>(`/schools/${schoolId}/exams/${examId}/paper`, { method: "POST", body: form }, token);
  },

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

  reportPickupDropoff: (token: string, studentId: number, eventType: "pickup" | "dropoff", notes?: string) =>
    request<PickupDropoffLog>(
      `/portal/students/${studentId}/pickup-dropoff`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_type: eventType, notes }) },
      token
    ),

  // --- Finance ---

  listExpenses: (token: string, schoolId: number, dateFrom?: string, dateTo?: string) => {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo) qs.set("date_to", dateTo);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<Expense[]>(`/schools/${schoolId}/finance/expenses${suffix}`, {}, token);
  },

  listFeePayments: (token: string, schoolId: number, dateFrom?: string, dateTo?: string) => {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo) qs.set("date_to", dateTo);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<FeePaymentHistory[]>(`/schools/${schoolId}/fees/payments${suffix}`, {}, token);
  },

  createExpense: (token: string, schoolId: number, payload: { category: string; description: string; amount: number; date: string }) =>
    request<Expense>(
      `/schools/${schoolId}/finance/expenses`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteExpense: (token: string, schoolId: number, expenseId: number) =>
    request<void>(`/schools/${schoolId}/finance/expenses/${expenseId}`, { method: "DELETE" }, token),

  approveExpense: (token: string, schoolId: number, expenseId: number) =>
    request<Expense>(`/schools/${schoolId}/finance/expenses/${expenseId}/approve`, { method: "POST" }, token),

  rejectExpense: (token: string, schoolId: number, expenseId: number, reason: string) =>
    request<Expense>(
      `/schools/${schoolId}/finance/expenses/${expenseId}/reject`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) },
      token
    ),

  getFinanceSummary: (token: string, schoolId: number) => request<FinanceSummary>(`/schools/${schoolId}/finance/summary`, {}, token),

  upsertResult: (
    token: string,
    schoolId: number,
    payload: { student_id: number; subject_id: number; term: string; exam_type: string; score: number; remarks?: string }
  ) =>
    request<Result>(
      `/schools/${schoolId}/results`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listGradingBands: (token: string, schoolId: number) =>
    request<GradingBand[]>(`/schools/${schoolId}/grading-bands`, {}, token),

  updateGradingBands: (
    token: string,
    schoolId: number,
    bands: { level_code: string; label: string; min_score: number; max_score: number; points: number }[]
  ) =>
    request<GradingBand[]>(
      `/schools/${schoolId}/grading-bands`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bands }) },
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
      target_roles?: string[];
      event_date?: string;
      event_end_date?: string;
      location?: string;
      send_sms?: boolean;
      send_email?: boolean;
    }
  ) =>
    request<{ announcement: Announcement; sms_sent: number; sms_error: string | null; email_sent: number; email_error: string | null }>(
      `/schools/${schoolId}/announcements`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  // --- Communication settings (bulk SMS) ---

  getCommunicationConfig: (token: string, schoolId: number) =>
    request<{ sms_configured: boolean; mobilesasa_sender_id: string | null; balance: number | null }>(
      `/schools/${schoolId}/communication-config`,
      {},
      token
    ),

  setCommunicationConfig: (
    token: string,
    schoolId: number,
    payload: Partial<{ mobilesasa_api_token: string; mobilesasa_sender_id: string }>
  ) =>
    request<{ sms_configured: boolean; mobilesasa_sender_id: string | null; balance: number | null }>(
      `/schools/${schoolId}/communication-config`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
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

  askToJoinLiveClass: (joinCode: string, name: string) =>
    request<{ request_code: string; status: string }>(
      `/live-classes/join/${joinCode}/request`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }
    ),

  liveClassWaitStatus: (joinCode: string, requestCode: string) =>
    request<{ status: "pending" | "admitted" | "denied"; join: JoinToken | null }>(
      `/live-classes/join/${joinCode}/status?request_code=${encodeURIComponent(requestCode)}`
    ),

  muteAllLiveClass: (token: string, schoolId: number, liveClassId: number) =>
    request<{ affected: number }>(`/schools/${schoolId}/live-classes/${liveClassId}/mute-all`, { method: "POST" }, token),

  setLiveSpeaking: (token: string, schoolId: number, liveClassId: number, identity: string, allowed: boolean) =>
    request<{ affected: number }>(
      `/schools/${schoolId}/live-classes/${liveClassId}/participants/${encodeURIComponent(identity)}/speaking`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allowed }) },
      token
    ),

  removeFromLiveClass: (token: string, schoolId: number, liveClassId: number, identity: string) =>
    request<{ affected: number }>(`/schools/${schoolId}/live-classes/${liveClassId}/participants/${encodeURIComponent(identity)}/remove`, { method: "POST" }, token),

  listLiveRequests: (token: string, schoolId: number, liveClassId: number) =>
    request<{ id: number; name: string; requested_at: string }[]>(`/schools/${schoolId}/live-classes/${liveClassId}/requests`, {}, token),

  decideLiveRequest: (token: string, schoolId: number, liveClassId: number, requestId: number, decision: "admit" | "deny") =>
    request<void>(`/schools/${schoolId}/live-classes/${liveClassId}/requests/${requestId}/${decision}`, { method: "POST" }, token),

  listLiveJoins: (token: string, schoolId: number, liveClassId: number) =>
    request<{ name: string; kind: string; joined_at: string }[]>(`/schools/${schoolId}/live-classes/${liveClassId}/joins`, {}, token),

  // --- Portal (parent/student self-service) ---

  getFamilyOverview: (token: string) => request<FamilyOverview>("/portal/overview", {}, token),

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

  listMyClasses: (token: string, schoolId: number) =>
    request<MyClass[]>(`/schools/${schoolId}/teacher-assignments/mine`, {}, token),

  // --- Timetable ---

  listTimetable: (token: string, schoolId: number, classId?: number) =>
    request<TimetableSlot[]>(`/schools/${schoolId}/timetable${classId ? `?class_id=${classId}` : ""}`, {}, token),

  listMyTimetable: (token: string, schoolId: number) =>
    request<MyTimetableSlot[]>(`/schools/${schoolId}/timetable/mine`, {}, token),

  getWeeklyMenu: (token: string, schoolId: number) => request<{ slots: MenuSlot[] }>(`/schools/${schoolId}/meals/weekly`, {}, token),
  getMenuTemplate: (token: string, schoolId: number) => request<MenuSlot[]>(`/schools/${schoolId}/meals/template`, {}, token),
  saveWeeklyMenu: (token: string, schoolId: number, slots: MenuSlot[]) =>
    request<{ applied: boolean; request_id: number | null; message: string }>(`/schools/${schoolId}/meals/weekly`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slots }) }, token),
  listStoreRequests: (token: string, schoolId: number, state?: string) => request<StoreRequest[]>(`/schools/${schoolId}/stores/requests${state ? `?state=${state}` : ""}`, {}, token),
  createStoreRequest: (token: string, schoolId: number, body: { department: string; note?: string; lines: { item_id: number; quantity: number }[] }) =>
    request<StoreRequest>(`/schools/${schoolId}/stores/requests`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  issueStoreRequest: (token: string, schoolId: number, id: number, quantities: Record<number, number> = {}) =>
    request<StoreRequest>(`/schools/${schoolId}/stores/requests/${id}/issue`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantities }) }, token),
  declineStoreRequest: (token: string, schoolId: number, id: number, note: string) =>
    request<StoreRequest>(`/schools/${schoolId}/stores/requests/${id}/decline`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) }, token),
  recordStockCount: (token: string, schoolId: number, body: { item_id: number; counted_quantity: number; reason: string }) =>
    request<StockMovement>(`/schools/${schoolId}/stores/counts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  getFinanceActivity: (token: string, schoolId: number, q: { start?: string; end?: string; actor_id?: number } = {}) => {
    const p = new URLSearchParams();
    if (q.start) p.set("start", q.start);
    if (q.end) p.set("end", q.end);
    if (q.actor_id) p.set("actor_id", String(q.actor_id));
    return request<FinanceActivity>(`/schools/${schoolId}/oversight/finance-activity?${p}`, {}, token);
  },
  libBooks: (token: string, schoolId: number, q: { q?: string; category?: string; available_only?: boolean } = {}) => {
    const p = new URLSearchParams();
    if (q.q) p.set("q", q.q);
    if (q.category) p.set("category", q.category);
    if (q.available_only) p.set("available_only", "true");
    return request<LibBook[]>(`/schools/${schoolId}/library/books?${p}`, {}, token);
  },
  libBook: (token: string, schoolId: number, id: number) => request<LibBookDetail>(`/schools/${schoolId}/library/books/${id}`, {}, token),
  libAddBook: (token: string, schoolId: number, body: { title: string; author?: string; isbn?: string; category?: string; shelf?: string; copies: number; condition?: string }) =>
    request<LibBookDetail>(`/schools/${schoolId}/library/books`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  libAddCopies: (token: string, schoolId: number, id: number, count: number) =>
    request<LibBookDetail>(`/schools/${schoolId}/library/books/${id}/copies`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count }) }, token),
  libCopy: (token: string, schoolId: number, number: string) => request<LibCopy>(`/schools/${schoolId}/library/copies/${encodeURIComponent(number)}`, {}, token),
  libIssue: (token: string, schoolId: number, body: { copy_number: string; student_id?: number; teacher_user_id?: number; for_class_id?: number; due_date?: string }) =>
    request<LibLoan>(`/schools/${schoolId}/library/loans`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  libReturn: (token: string, schoolId: number, loanId: number, condition = "good") =>
    request<LibLoan>(`/schools/${schoolId}/library/loans/${loanId}/return`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ condition }) }, token),
  libLoans: (token: string, schoolId: number, q: { state?: string; q?: string } = {}) => {
    const p = new URLSearchParams();
    if (q.state) p.set("state", q.state);
    if (q.q) p.set("q", q.q);
    return request<LibLoan[]>(`/schools/${schoolId}/library/loans?${p}`, {}, token);
  },
  libTeachers: (token: string, schoolId: number) => request<{ user_id: number; full_name: string }[]>(`/schools/${schoolId}/library/teachers`, {}, token),
  libMine: (token: string, schoolId: number) => request<{ sets: LibClassSet[]; learner_loans: LibLoan[] }>(`/schools/${schoolId}/library/mine`, {}, token),
  libMyBooks: (token: string, schoolId: number) => request<LibLoan[]>(`/schools/${schoolId}/library/my-books`, {}, token),
  libOverview: (token: string, schoolId: number) => request<LibOverview>(`/schools/${schoolId}/library/overview`, {}, token),
  getFeeStructure: (token: string, schoolId: number, term: string) => request<FeeStructure>(`/schools/${schoolId}/fees/structure?term=${encodeURIComponent(term)}`, {}, token),
  saveFeeStructure: (token: string, schoolId: number, term: string, lines: { grade_level_id: number; category: string; amount: number }[]) =>
    request<{ applied: boolean; request_id: number | null; message: string }>(`/schools/${schoolId}/fees/structure`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ term, lines }) }, token),
  generateInvoices: (token: string, schoolId: number, term: string, dueDate?: string) =>
    request<{ created: number; skipped_existing: number; learners_without_grade: number; total_billed: number }>(`/schools/${schoolId}/fees/structure/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ term, due_date: dueDate || null }) }, token),
  getFeeBalances: (token: string, schoolId: number, q: { term?: string; class_id?: number; min_owed?: number; max_owed?: number; exact_owed?: number; arrears_only?: boolean; owing_only?: boolean; q?: string }) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "" && v !== null) p.set(k, String(v));
    return request<FeeBalances>(`/schools/${schoolId}/fees/balances?${p}`, {}, token);
  },
  remindParents: (token: string, schoolId: number, body: { term?: string; student_ids: number[]; message?: string; sms: boolean; email: boolean }) =>
    request<{ sms_sent: number; email_sent: number; no_contact: string[]; sms_error: string | null; email_error: string | null }>(`/schools/${schoolId}/fees/balances/remind`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  listSchoolAccounts: (token: string, schoolId: number) => request<LeadershipAccount[]>(`/schools/${schoolId}/leadership/accounts`, {}, token),
  switchAccount: (token: string, schoolId: number, userId: number, active: boolean, reason?: string) =>
    request<LeadershipAccount>(`/schools/${schoolId}/leadership/accounts/${userId}/active`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active, reason: reason || null }) }, token),
  handOverSchool: (token: string, schoolId: number, body: { outgoing_user_id: number; existing_user_id?: number; new_head?: { full_name: string; email: string; password: string }; reason: string }) =>
    request<{ outgoing: LeadershipAccount; incoming: LeadershipAccount; message: string }>(`/schools/${schoolId}/leadership/handover`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  getGroupSchools: (token: string) => request<GroupSchoolInfo[]>(`/group/schools`, {}, token),
  getGroupOverview: (token: string) => request<GroupOverview>(`/group/overview`, {}, token),
  getGroupAttention: (token: string) => request<GroupAttentionSummary>(`/group/attention`, {}, token),
  listGroupModules: (token: string) => request<GroupModuleInfo[]>(`/group/modules`, {}, token),
  getGroupComparison: (token: string, key: string, on?: string) => request<GroupComparison>(`/group/modules/${key}${on ? `?on=${on}` : ""}`, {}, token),
  getGroupActivity: (token: string, q: { start?: string; end?: string; kinds?: string[] } = {}) => {
    const p = new URLSearchParams();
    if (q.start) p.set("start", q.start);
    if (q.end) p.set("end", q.end);
    if (q.kinds?.length) p.set("kinds", q.kinds.join(","));
    return request<GroupActivity>(`/group/activity?${p}`, {}, token);
  },
  getGroupReport: (token: string) => request<GroupWeeklyReport>(`/group/weekly-report`, {}, token),
  emailGroupReport: (token: string) => request<{ sent: boolean }>(`/group/weekly-report/email-me`, { method: "POST" }, token),
  listMeetings: (token: string) => request<StaffMeeting[]>(`/meetings`, {}, token),
  meetingCandidates: (token: string) => request<MeetingCandidateSchool[]>(`/meetings/candidates`, {}, token),
  scheduleMeeting: (token: string, body: { title: string; agenda?: string; scheduled_start: string; school_ids: number[]; audience: "all" | "selected"; teacher_ids: number[] }) =>
    request<StaffMeeting>(`/meetings`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  meetingToken: (token: string, id: number) => request<JoinToken>(`/meetings/${id}/token`, { method: "POST" }, token),
  endMeeting: (token: string, id: number) => request<StaffMeeting>(`/meetings/${id}/end`, { method: "POST" }, token),
  meetingAttendance: (token: string, id: number) => request<MeetingAttendance>(`/meetings/${id}/attendance`, {}, token),
  listSchoolPeriods: (token: string, schoolId: number) => request<SchoolPeriod[]>(`/schools/${schoolId}/timetable/periods`, {}, token),
  getPeriodTemplate: (token: string, schoolId: number, levelGroup: string, withPrep: boolean) =>
    request<PeriodDraft[]>(`/schools/${schoolId}/timetable/periods/template?level_group=${levelGroup}&with_prep=${withPrep}`, {}, token),
  saveSchoolDay: (token: string, schoolId: number, levelGroup: string, periods: PeriodDraft[]) =>
    request<{ applied: boolean; request_id: number | null; message: string }>(
      `/schools/${schoolId}/timetable/periods/${levelGroup}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ periods }) },
      token
    ),
  listApprovals: (token: string, schoolId: number, kind?: string, pendingOnly = false) =>
    request<ChangeRequest[]>(`/schools/${schoolId}/approvals?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(pendingOnly ? { pending_only: "true" } : {}) })}`, {}, token),
  decideApproval: (token: string, schoolId: number, id: number, approve: boolean, note?: string) =>
    request<ChangeRequest>(`/schools/${schoolId}/approvals/${id}/${approve ? "approve" : "reject"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: note || null }) }, token),

  createTimetableSlot: (
    token: string,
    schoolId: number,
    payload: { class_id: number; subject_id: number; teacher_user_id?: number; day_of_week: number; period_id?: number; start_time?: string; end_time?: string; room?: string }
  ) =>
    request<TimetableSlot>(
      `/schools/${schoolId}/timetable`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteTimetableSlot: (token: string, schoolId: number, slotId: number) =>
    request<void>(`/schools/${schoolId}/timetable/${slotId}`, { method: "DELETE" }, token),

  // --- Staff attendance & duty roster ---

  clockIn: (token: string, schoolId: number, note?: string) =>
    request<StaffAttendanceRecord>(
      `/schools/${schoolId}/staff-attendance/clock-in`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) },
      token
    ),

  clockOut: (token: string, schoolId: number) =>
    request<StaffAttendanceRecord>(`/schools/${schoolId}/staff-attendance/clock-out`, { method: "POST" }, token),

  getAttendanceQrCode: (token: string, schoolId: number) =>
    request<{ token: string }>(`/schools/${schoolId}/staff-attendance/qr-code`, {}, token),

  scanAttendanceQr: (token: string, schoolId: number, qrToken: string) =>
    request<{ action: "clocked_in" | "clocked_out"; record: StaffAttendanceRecord }>(
      `/schools/${schoolId}/staff-attendance/scan`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: qrToken }) },
      token
    ),

  myStaffAttendance: (token: string, schoolId: number, dateFrom?: string, dateTo?: string) => {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo) qs.set("date_to", dateTo);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<StaffAttendanceRecord[]>(`/schools/${schoolId}/staff-attendance/mine${suffix}`, {}, token);
  },

  listStaffAttendance: (token: string, schoolId: number, dateFrom?: string, dateTo?: string) => {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo) qs.set("date_to", dateTo);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<StaffAttendanceWithName[]>(`/schools/${schoolId}/staff-attendance${suffix}`, {}, token);
  },

  getStaffDay: (token: string, schoolId: number, date: string) =>
    request<StaffDay>(`/schools/${schoolId}/staff-attendance/day?date=${date}`, {}, token),

  getStaffSummary: (token: string, schoolId: number, dateFrom: string, dateTo: string, userId?: number) =>
    request<StaffSummary>(`/schools/${schoolId}/staff-attendance/summary?date_from=${dateFrom}&date_to=${dateTo}${userId ? `&user_id=${userId}` : ""}`, {}, token),

  getStaffSettings: (token: string, schoolId: number) =>
    request<{ late_after: string; absent_after: string }>(`/schools/${schoolId}/staff-attendance/settings`, {}, token),

  setStaffSettings: (token: string, schoolId: number, payload: { late_after: string; absent_after: string }) =>
    request<{ late_after: string; absent_after: string }>(
      `/schools/${schoolId}/staff-attendance/settings`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listStaffPeople: (token: string, schoolId: number) => request<StaffPerson[]>(`/schools/${schoolId}/staff-attendance/people`, {}, token),

  setStaffTracking: (token: string, schoolId: number, userId: number, tracked: boolean) =>
    request<void>(
      `/schools/${schoolId}/staff-attendance/tracking`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, tracked }) },
      token
    ),

  listStaffLeaves: (token: string, schoolId: number) => request<StaffLeave[]>(`/schools/${schoolId}/staff-attendance/leaves`, {}, token),

  recordStaffLeave: (
    token: string,
    schoolId: number,
    payload: { user_id: number; start_date: string; end_date: string; leave_type: string; note?: string }
  ) =>
    request<StaffLeave>(
      `/schools/${schoolId}/staff-attendance/leaves`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteStaffLeave: (token: string, schoolId: number, leaveId: number) =>
    request<void>(`/schools/${schoolId}/staff-attendance/leaves/${leaveId}`, { method: "DELETE" }, token),

  setAbsenceNote: (token: string, schoolId: number, payload: { user_id: number; date: string; reason: string; note?: string }) =>
    request<void>(
      `/schools/${schoolId}/staff-attendance/notes`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  clearAbsenceNote: (token: string, schoolId: number, userId: number, date: string) =>
    request<void>(`/schools/${schoolId}/staff-attendance/notes?user_id=${userId}&date=${date}`, { method: "DELETE" }, token),

  listMyDuties: (token: string, schoolId: number) =>
    request<DutyAssignment[]>(`/schools/${schoolId}/duties/mine`, {}, token),

  listDuties: (token: string, schoolId: number, dateFrom?: string, dateTo?: string) => {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo) qs.set("date_to", dateTo);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<DutyAssignmentWithName[]>(`/schools/${schoolId}/duties${suffix}`, {}, token);
  },

  createDuty: (
    token: string,
    schoolId: number,
    payload: { user_id: number; title: string; date: string; start_time?: string; end_time?: string; notes?: string }
  ) =>
    request<DutyAssignment>(
      `/schools/${schoolId}/duties`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteDuty: (token: string, schoolId: number, dutyId: number) =>
    request<void>(`/schools/${schoolId}/duties/${dutyId}`, { method: "DELETE" }, token),

  // --- Supervisors ---

  listSupervisors: (token: string) => request<Supervisor[]>(`/supervisors`, {}, token),

  createSupervisor: (token: string, payload: { email: string; full_name: string; password: string }) =>
    request<Supervisor>(`/supervisors`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, token),

  linkSupervisorSchool: (token: string, supervisorId: number, schoolId: number) =>
    request<Supervisor>(
      `/supervisors/${supervisorId}/schools`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ school_id: schoolId }) },
      token
    ),

  unlinkSupervisorSchool: (token: string, supervisorId: number, schoolId: number) =>
    request<Supervisor>(`/supervisors/${supervisorId}/schools/${schoolId}`, { method: "DELETE" }, token),

  listMyLinkedSchools: (token: string) => request<LinkedSchool[]>(`/supervisor/schools`, {}, token),

  getSupervisorOverview: (token: string) => request<SupervisorOverview>(`/supervisor/overview`, {}, token),

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
    payload: { registration_number: string; capacity: number; driver_name: string; driver_phone: string; vehicle_type?: string; make_model?: string; insurance_expiry?: string; inspection_expiry?: string; next_service_date?: string; attendant_user_id?: number }
  ) =>
    request<Vehicle>(
      `/schools/${schoolId}/transport/vehicles`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listTransportRoutes: (token: string, schoolId: number) =>
    request<TransportRoute[]>(`/schools/${schoolId}/transport/routes`, {}, token),

  updateVehicle: (token: string, schoolId: number, id: number, body: Partial<Vehicle>) =>
    request<Vehicle>(`/schools/${schoolId}/transport/vehicles/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  listAttendants: (token: string, schoolId: number) => request<{ user_id: number; full_name: string }[]>(`/schools/${schoolId}/transport/attendants`, {}, token),
  listRuns: (token: string, schoolId: number, on?: string) => request<RunSummary[]>(`/schools/${schoolId}/transport/runs${on ? `?on=${on}` : ""}`, {}, token),
  startRun: (token: string, schoolId: number, routeId: number, direction: string) =>
    request<RunDetail>(`/schools/${schoolId}/transport/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ route_id: routeId, direction }) }, token),
  getRun: (token: string, schoolId: number, runId: number) => request<RunDetail>(`/schools/${schoolId}/transport/runs/${runId}`, {}, token),
  markRunStudent: (token: string, schoolId: number, runId: number, studentId: number, body: { status: string; handed_to?: string; note?: string }) =>
    request<RunDetail>(`/schools/${schoolId}/transport/runs/${runId}/students/${studentId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, token),
  completeRun: (token: string, schoolId: number, runId: number, note?: string) =>
    request<RunDetail>(`/schools/${schoolId}/transport/runs/${runId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: note || null }) }, token),
  getTransportOverview: (token: string, schoolId: number, q: { on?: string; class_id?: number } = {}) => {
    const p = new URLSearchParams();
    if (q.on) p.set("on", q.on);
    if (q.class_id) p.set("class_id", String(q.class_id));
    return request<TransportOverview>(`/schools/${schoolId}/oversight/transport?${p}`, {}, token);
  },
  createTransportRoute: (
    token: string,
    schoolId: number,
    payload: { name: string; description?: string; vehicle_id?: number; school_arrival_time?: string; afternoon_departure_time?: string }
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

  getChildTimetable: (token: string, studentId: number) =>
    request<TimetableSlot[]>(`/portal/students/${studentId}/timetable`, {}, token),

  getChildLiveClasses: (token: string, studentId: number) =>
    request<LiveClass[]>(`/portal/students/${studentId}/live-classes`, {}, token),

  getChildTrips: (token: string, studentId: number) =>
    request<Trip[]>(`/portal/students/${studentId}/trips`, {}, token),

  getChildLiveClassJoinToken: (token: string, studentId: number, liveClassId: number) =>
    request<JoinToken>(`/portal/students/${studentId}/live-classes/${liveClassId}/join-token`, { method: "POST" }, token),

  listComplaints: (token: string, schoolId: number) => request<Complaint[]>(`/schools/${schoolId}/complaints`, {}, token),

  raiseComplaint: (
    token: string,
    schoolId: number,
    payload: { audience: "class_teacher" | "principal"; subject: string; message: string; student_id?: number }
  ) =>
    request<Complaint>(
      `/schools/${schoolId}/complaints`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  respondToComplaint: (token: string, schoolId: number, complaintId: number, response: string) =>
    request<Complaint>(
      `/schools/${schoolId}/complaints/${complaintId}/respond`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response }) },
      token
    ),

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

  listAwards: (token: string, schoolId: number, params: { student_id?: number; include_shared?: boolean } = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
    return request<Award[]>(`/schools/${schoolId}/awards${qs ? `?${qs}` : ""}`, {}, token);
  },

  getAward: (token: string, schoolId: number, awardId: number) => request<Award>(`/schools/${schoolId}/awards/${awardId}`, {}, token),

  createAward: (
    token: string,
    schoolId: number,
    payload: {
      scope?: AwardScope;
      student_id?: number;
      staff_user_id?: number;
      class_id?: number;
      subject_id?: number;
      title: string;
      description?: string;
      category?: string;
      date_awarded: string;
      notify_guardian?: boolean;
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

  // --- Conduct reports ---

  listConductReports: (token: string, schoolId: number, studentId?: number) =>
    request<ConductReport[]>(`/schools/${schoolId}/conduct-reports${studentId ? `?student_id=${studentId}` : ""}`, {}, token),

  createConductReport: (
    token: string,
    schoolId: number,
    payload: { student_id: number; category: ConductCategory; description: string; action_taken?: string; incident_date: string }
  ) =>
    request<ConductReport>(
      `/schools/${schoolId}/conduct-reports`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  respondConductReport: (token: string, schoolId: number, reportId: number, response: string) =>
    request<ConductReport>(
      `/schools/${schoolId}/conduct-reports/${reportId}/respond`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response }) },
      token
    ),

  // --- Admissions CRM ---

  listLeads: (token: string, schoolId: number) => request<Lead[]>(`/schools/${schoolId}/leads`, {}, token),

  createLead: (
    token: string,
    schoolId: number,
    payload: {
      child_name: string;
      grade_interested?: string;
      guardian_name: string;
      guardian_phone?: string;
      guardian_email?: string;
      source?: string;
      notes?: string;
    }
  ) =>
    request<Lead>(
      `/schools/${schoolId}/leads`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  updateLead: (
    token: string,
    schoolId: number,
    leadId: number,
    payload: Partial<{
      child_name: string;
      grade_interested: string;
      guardian_name: string;
      guardian_phone: string;
      guardian_email: string;
      source: string;
      stage: LeadStage;
      notes: string;
    }>
  ) =>
    request<Lead>(
      `/schools/${schoolId}/leads/${leadId}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteLead: (token: string, schoolId: number, leadId: number) =>
    request<void>(`/schools/${schoolId}/leads/${leadId}`, { method: "DELETE" }, token),

  convertLead: (
    token: string,
    schoolId: number,
    leadId: number,
    payload: { admission_number: string; first_name: string; last_name: string; class_id?: number }
  ) =>
    request<Student>(
      `/schools/${schoolId}/leads/${leadId}/convert`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  // --- School calendar ---

  listCalendarEvents: (token: string, schoolId: number, fromDate?: string, toDate?: string) => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from_date", fromDate);
    if (toDate) params.set("to_date", toDate);
    const qs = params.toString();
    return request<CalendarEvent[]>(`/schools/${schoolId}/calendar-events${qs ? `?${qs}` : ""}`, {}, token);
  },

  createCalendarEvent: (
    token: string,
    schoolId: number,
    payload: { title: string; event_type: CalendarEventType; start_date: string; end_date?: string; description?: string }
  ) =>
    request<CalendarEvent>(
      `/schools/${schoolId}/calendar-events`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  updateCalendarEvent: (
    token: string,
    schoolId: number,
    eventId: number,
    payload: Partial<{ title: string; event_type: CalendarEventType; start_date: string; end_date: string | null; description: string }>
  ) =>
    request<CalendarEvent>(
      `/schools/${schoolId}/calendar-events/${eventId}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteCalendarEvent: (token: string, schoolId: number, eventId: number) =>
    request<void>(`/schools/${schoolId}/calendar-events/${eventId}`, { method: "DELETE" }, token),

  // --- Dashboard summary ---

  getDashboardSummary: (token: string, schoolId: number) =>
    request<DashboardSummary>(`/schools/${schoolId}/dashboard/summary`, {}, token),

  getGroupSummary: (token: string, schoolId: number) =>
    request<GroupSummary>(`/schools/${schoolId}/dashboard/group-summary`, {}, token),

  // --- Activities & Competitions ---

  listActivities: (token: string, schoolId: number) => request<Activity[]>(`/schools/${schoolId}/activities`, {}, token),

  createActivity: (
    token: string,
    schoolId: number,
    payload: { name: string; category?: string; date: string; description?: string; scope?: "school" | "class" | "invited"; class_id?: number }
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

  awardFromActivity: (
    token: string,
    schoolId: number,
    activityId: number,
    awards: { student_id: number; title: string; description?: string; category?: string }[],
    notifyGuardian = true
  ) =>
    request<Award[]>(
      `/schools/${schoolId}/activities/${activityId}/awards`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ awards, notify_guardian: notifyGuardian }) },
      token
    ),

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

  // --- Lesson Plans ---

  listLessonPlans: (token: string, schoolId: number, params?: { class_id?: number; subject_id?: number; term?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ).toString();
    return request<LessonPlan[]>(`/schools/${schoolId}/lesson-plans${qs ? `?${qs}` : ""}`, {}, token);
  },

  createLessonPlan: (token: string, schoolId: number, payload: { class_id: number; subject_id: number; term: string }) =>
    request<LessonPlanDetail>(
      `/schools/${schoolId}/lesson-plans`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  getLessonPlan: (token: string, schoolId: number, planId: number) =>
    request<LessonPlanDetail>(`/schools/${schoolId}/lesson-plans/${planId}`, {}, token),

  deleteLessonPlan: (token: string, schoolId: number, planId: number) =>
    request<void>(`/schools/${schoolId}/lesson-plans/${planId}`, { method: "DELETE" }, token),

  // --- Homework ---

  listHomework: (token: string, schoolId: number, classId?: number) => {
    const qs = classId ? `?class_id=${classId}` : "";
    return request<HomeworkListItem[]>(`/schools/${schoolId}/homework${qs}`, {}, token);
  },

  createHomework: (
    token: string,
    schoolId: number,
    payload: { class_id: number; subject_id: number; title: string; homework_type?: string; instructions?: string; due_date: string; allow_digital_submission: boolean; given_on_board?: boolean }
  ) =>
    request<HomeworkListItem>(
      `/schools/${schoolId}/homework`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  getHomework: (token: string, schoolId: number, homeworkId: number) =>
    request<HomeworkDetail>(`/schools/${schoolId}/homework/${homeworkId}`, {}, token),

  uploadHomeworkAttachment: (token: string, schoolId: number, homeworkId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<HomeworkListItem>(`/schools/${schoolId}/homework/${homeworkId}/attachment`, { method: "POST", body: form }, token);
  },

  remindHomework: (token: string, schoolId: number, homeworkId: number) =>
    request<{ reminded: number }>(`/schools/${schoolId}/homework/${homeworkId}/remind`, { method: "POST" }, token),

  reviewHomeworkSubmission: (
    token: string,
    schoolId: number,
    homeworkId: number,
    studentId: number,
    payload: { status: HomeworkSubmissionStatus; score?: number; teacher_comment?: string }
  ) =>
    request<HomeworkSubmissionRow>(
      `/schools/${schoolId}/homework/${homeworkId}/submissions/${studentId}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteHomework: (token: string, schoolId: number, homeworkId: number) =>
    request<void>(`/schools/${schoolId}/homework/${homeworkId}`, { method: "DELETE" }, token),

  getChildHomework: (token: string, studentId: number) =>
    request<HomeworkForStudent[]>(`/portal/students/${studentId}/homework`, {}, token),

  submitChildHomework: (token: string, studentId: number, homeworkId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<HomeworkForStudent>(`/portal/students/${studentId}/homework/${homeworkId}/submit`, { method: "POST", body: form }, token);
  },

  addLessonPlanEntry: (
    token: string,
    schoolId: number,
    planId: number,
    payload: { order: number; label: string; scheduled_date?: string; topic: string; objectives?: string; resources?: string; notes?: string }
  ) =>
    request<LessonPlanEntry>(
      `/schools/${schoolId}/lesson-plans/${planId}/entries`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  replaceLessonPlanEntries: (
    token: string,
    schoolId: number,
    planId: number,
    entries: { order: number; label: string; scheduled_date?: string; topic: string; objectives?: string; resources?: string; notes?: string }[]
  ) =>
    request<LessonPlanDetail>(
      `/schools/${schoolId}/lesson-plans/${planId}/entries`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entries) },
      token
    ),

  updateLessonPlanEntry: (
    token: string,
    schoolId: number,
    planId: number,
    entryId: number,
    payload: Partial<{ order: number; label: string; scheduled_date: string; topic: string; objectives: string; resources: string; notes: string; status: LessonPlanEntryStatus }>
  ) =>
    request<LessonPlanEntry>(
      `/schools/${schoolId}/lesson-plans/${planId}/entries/${entryId}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  deleteLessonPlanEntry: (token: string, schoolId: number, planId: number, entryId: number) =>
    request<void>(`/schools/${schoolId}/lesson-plans/${planId}/entries/${entryId}`, { method: "DELETE" }, token),

  reorderLessonPlanEntries: (token: string, schoolId: number, planId: number, entryIds: number[]) =>
    request<LessonPlanDetail>(
      `/schools/${schoolId}/lesson-plans/${planId}/entries/reorder`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entry_ids: entryIds }) },
      token
    ),

  duplicateLessonPlan: (token: string, schoolId: number, planId: number, payload: { class_id: number; subject_id: number; term: string }) =>
    request<LessonPlanDetail>(
      `/schools/${schoolId}/lesson-plans/${planId}/duplicate`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  getLessonDay: (token: string, schoolId: number, date?: string) =>
    request<LessonDay>(`/schools/${schoolId}/lessons/day${date ? `?date=${date}` : ""}`, {}, token),

  markLesson: (
    token: string,
    schoolId: number,
    payload: { timetable_slot_id: number; lesson_date: string; status: DeliveryStatus; reason?: NotTaughtReason; remark?: string; entry_id?: number }
  ) =>
    request<LessonDelivery>(
      `/schools/${schoolId}/lessons/deliveries`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  undoLessonMark: (token: string, schoolId: number, deliveryId: number) =>
    request<void>(`/schools/${schoolId}/lessons/deliveries/${deliveryId}`, { method: "DELETE" }, token),

  getRecordOfWork: (token: string, schoolId: number, params: { date_from?: string; date_to?: string; teacher_user_id?: number }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString();
    return request<RecordOfWorkRow[]>(`/schools/${schoolId}/lessons/deliveries${qs ? `?${qs}` : ""}`, {}, token);
  },

  getLessonCoverage: (token: string, schoolId: number, term: string) =>
    request<Coverage>(`/schools/${schoolId}/lessons/coverage?term=${encodeURIComponent(term)}`, {}, token),

  // --- Boarding ---

  listBoardingHouses: (token: string, schoolId: number) =>
    request<BoardingHouse[]>(`/schools/${schoolId}/boarding/houses`, {}, token),

  createBoardingHouse: (token: string, schoolId: number, payload: { name: string; gender: string; total_beds: number }) =>
    request<BoardingHouse>(
      `/schools/${schoolId}/boarding/houses`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listBoardingAssignments: (token: string, schoolId: number, houseId?: number) => {
    const qs = houseId ? `?house_id=${houseId}` : "";
    return request<BoardingAssignment[]>(`/schools/${schoolId}/boarding/assignments${qs}`, {}, token);
  },

  assignBed: (token: string, schoolId: number, payload: { student_id: number; house_id: number; bed_number: string }) =>
    request<BoardingAssignment>(
      `/schools/${schoolId}/boarding/assignments`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listRollCalls: (token: string, schoolId: number, houseId: number, date: string) =>
    request<RollCall[]>(`/schools/${schoolId}/boarding/roll-calls?house_id=${houseId}&date=${date}`, {}, token),

  submitRollCall: (
    token: string,
    schoolId: number,
    payload: { house_id: number; date: string; session: RollSession; marks: Record<string, string> }
  ) =>
    request<RollCall>(
      `/schools/${schoolId}/boarding/roll-calls`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listExeats: (token: string, schoolId: number, status?: ExeatStatus) => {
    const qs = status ? `?status_filter=${status}` : "";
    return request<Exeat[]>(`/schools/${schoolId}/boarding/exeats${qs}`, {}, token);
  },

  createExeat: (
    token: string,
    schoolId: number,
    payload: {
      student_id: number;
      from_date: string;
      to_date: string;
      reason: string;
      detail?: string;
      pickup_name: string;
      pickup_relation?: string;
      pickup_phone?: string;
    }
  ) =>
    request<Exeat>(
      `/schools/${schoolId}/boarding/exeats`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  approveExeat: (token: string, schoolId: number, exeatId: number) =>
    request<Exeat>(`/schools/${schoolId}/boarding/exeats/${exeatId}/approve`, { method: "POST" }, token),

  denyExeat: (token: string, schoolId: number, exeatId: number) =>
    request<Exeat>(`/schools/${schoolId}/boarding/exeats/${exeatId}/deny`, { method: "POST" }, token),

  checkOutExeat: (token: string, schoolId: number, exeatId: number) =>
    request<Exeat>(`/schools/${schoolId}/boarding/exeats/${exeatId}/check-out`, { method: "POST" }, token),

  checkInExeat: (token: string, schoolId: number, exeatId: number) =>
    request<Exeat>(`/schools/${schoolId}/boarding/exeats/${exeatId}/check-in`, { method: "POST" }, token),

  listSickBayVisits: (token: string, schoolId: number) =>
    request<SickBayVisit[]>(`/schools/${schoolId}/boarding/sick-bay`, {}, token),

  createSickBayVisit: (
    token: string,
    schoolId: number,
    payload: { student_id: number; complaint: string; temperature?: number; action: SickBayAction; parent_notified?: boolean }
  ) =>
    request<SickBayVisit>(
      `/schools/${schoolId}/boarding/sick-bay`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listBoardingIncidents: (token: string, schoolId: number) =>
    request<BoardingIncident[]>(`/schools/${schoolId}/boarding/incidents`, {}, token),

  createBoardingIncident: (
    token: string,
    schoolId: number,
    payload: { house_id: number; type: string; description: string; action_taken: string }
  ) =>
    request<BoardingIncident>(
      `/schools/${schoolId}/boarding/incidents`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  closeBoardingIncident: (token: string, schoolId: number, incidentId: number) =>
    request<BoardingIncident>(`/schools/${schoolId}/boarding/incidents/${incidentId}/close`, { method: "POST" }, token),

  findExeatByGatePass: (token: string, schoolId: number, code: string) =>
    request<Exeat>(`/schools/${schoolId}/boarding/exeats/by-pass/${encodeURIComponent(code)}`, {}, token),

  // --- Security ---

  listVisitors: (token: string, schoolId: number, dateFrom?: string, dateTo?: string) => {
    const qs = new URLSearchParams();
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo) qs.set("date_to", dateTo);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request<Visitor[]>(`/schools/${schoolId}/security/visitors${suffix}`, {}, token);
  },

  signInVisitor: (
    token: string,
    schoolId: number,
    payload: { name: string; id_number: string; phone: string; purpose: string; host_name: string; vehicle_registration?: string }
  ) =>
    request<Visitor>(
      `/schools/${schoolId}/security/visitors`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  signOutVisitor: (token: string, schoolId: number, visitorId: number) =>
    request<Visitor>(`/schools/${schoolId}/security/visitors/${visitorId}/sign-out`, { method: "POST" }, token),

  listVehicleLogs: (token: string, schoolId: number) => request<VehicleLogEntry[]>(`/schools/${schoolId}/security/vehicles`, {}, token),

  logVehicle: (
    token: string,
    schoolId: number,
    payload: { registration: string; direction: VehicleDirection; driver_name: string; purpose: string }
  ) =>
    request<VehicleLogEntry>(
      `/schools/${schoolId}/security/vehicles`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listVehicleReleaseRequests: (token: string, schoolId: number, statusFilter?: VehicleReleaseStatus) =>
    request<VehicleReleaseRequest[]>(
      `/schools/${schoolId}/security/vehicles/release-requests${statusFilter ? `?status=${statusFilter}` : ""}`,
      {},
      token
    ),

  createVehicleReleaseRequest: (token: string, schoolId: number, payload: { registration: string; driver_name: string; purpose: string }) =>
    request<VehicleReleaseRequest>(
      `/schools/${schoolId}/security/vehicles/release-requests`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  approveVehicleReleaseRequest: (token: string, schoolId: number, requestId: number, note?: string) =>
    request<VehicleReleaseRequest>(
      `/schools/${schoolId}/security/vehicles/release-requests/${requestId}/approve`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) },
      token
    ),

  rejectVehicleReleaseRequest: (token: string, schoolId: number, requestId: number, note?: string) =>
    request<VehicleReleaseRequest>(
      `/schools/${schoolId}/security/vehicles/release-requests/${requestId}/reject`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) },
      token
    ),

  listEarlyPickups: (token: string, schoolId: number) => request<EarlyPickup[]>(`/schools/${schoolId}/security/pickups`, {}, token),

  logEarlyPickup: (
    token: string,
    schoolId: number,
    payload: { student_id: number; collected_by: string; relation: string; reason: string; verified?: boolean; note?: string }
  ) =>
    request<EarlyPickup>(
      `/schools/${schoolId}/security/pickups`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listSecurityIncidents: (token: string, schoolId: number) =>
    request<SecurityIncident[]>(`/schools/${schoolId}/security/incidents`, {}, token),

  reportSecurityIncident: (
    token: string,
    schoolId: number,
    payload: { type: string; location: string; severity: IncidentSeverity; description: string; action_taken: string }
  ) =>
    request<SecurityIncident>(
      `/schools/${schoolId}/security/incidents`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  closeSecurityIncident: (token: string, schoolId: number, incidentId: number) =>
    request<SecurityIncident>(`/schools/${schoolId}/security/incidents/${incidentId}/close`, { method: "POST" }, token),

  listSecurityAlerts: (token: string, schoolId: number) => request<SecurityAlert[]>(`/schools/${schoolId}/security/alerts`, {}, token),

  raiseSecurityAlert: (token: string, schoolId: number, payload: { type: string; message: string; sms_parents?: boolean }) =>
    request<SecurityAlert>(
      `/schools/${schoolId}/security/alerts`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  standDownSecurityAlert: (token: string, schoolId: number, alertId: number) =>
    request<SecurityAlert>(`/schools/${schoolId}/security/alerts/${alertId}/stand-down`, { method: "POST" }, token),

  listPatrolLogs: (token: string, schoolId: number) => request<PatrolLogEntry[]>(`/schools/${schoolId}/security/patrols`, {}, token),

  logPatrol: (token: string, schoolId: number, payload: { post: string; ok?: boolean; note: string }) =>
    request<PatrolLogEntry>(
      `/schools/${schoolId}/security/patrols`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  // --- Trips ---

  listTrips: (token: string, schoolId: number) => request<Trip[]>(`/schools/${schoolId}/trips`, {}, token),

  requestTrip: (
    token: string,
    schoolId: number,
    payload: {
      title: string;
      trip_type: string;
      purpose: string;
      destination: string;
      start_date: string;
      end_date: string;
      departure_time: string;
      return_time: string;
      class_ids: number[];
      student_ids: number[];
      staff_count: number;
      distance_km: number;
    }
  ) =>
    request<Trip>(
      `/schools/${schoolId}/trips`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  approveTrip: (token: string, schoolId: number, tripId: number, vehicleId?: number) =>
    request<Trip>(
      `/schools/${schoolId}/trips/${tripId}/approve`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vehicle_id: vehicleId }) },
      token
    ),

  declineTrip: (token: string, schoolId: number, tripId: number) =>
    request<Trip>(`/schools/${schoolId}/trips/${tripId}/decline`, { method: "POST" }, token),

  startTrip: (token: string, schoolId: number, tripId: number) =>
    request<Trip>(`/schools/${schoolId}/trips/${tripId}/start`, { method: "POST" }, token),

  completeTrip: (token: string, schoolId: number, tripId: number) =>
    request<Trip>(`/schools/${schoolId}/trips/${tripId}/complete`, { method: "POST" }, token),

  cancelTrip: (token: string, schoolId: number, tripId: number) =>
    request<Trip>(`/schools/${schoolId}/trips/${tripId}/cancel`, { method: "POST" }, token),

  // --- Ledger / ERP finance ---

  listLedgerAccounts: (token: string, schoolId: number) => request<LedgerAccount[]>(`/schools/${schoolId}/ledger/accounts`, {}, token),

  listJournalEntries: (token: string, schoolId: number) => request<JournalEntry[]>(`/schools/${schoolId}/ledger/entries`, {}, token),

  createJournalEntry: (
    token: string,
    schoolId: number,
    payload: { entry_date: string; reference: string; memo: string; lines: { account_id: number; debit: number; credit: number }[] }
  ) =>
    request<JournalEntry>(
      `/schools/${schoolId}/ledger/entries`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  getTrialBalance: (token: string, schoolId: number) => request<TrialBalanceRow[]>(`/schools/${schoolId}/ledger/trial-balance`, {}, token),

  getIncomeStatement: (token: string, schoolId: number) => request<IncomeStatement>(`/schools/${schoolId}/ledger/income-statement`, {}, token),

  getBalanceSheet: (token: string, schoolId: number) => request<BalanceSheet>(`/schools/${schoolId}/ledger/balance-sheet`, {}, token),

  // --- Suppliers ---

  listSuppliers: (token: string, schoolId: number) => request<Supplier[]>(`/schools/${schoolId}/suppliers`, {}, token),

  createSupplier: (
    token: string,
    schoolId: number,
    payload: { name: string; kra_pin: string; category: string; phone: string; email: string; bank_account?: string; etims_registered?: boolean }
  ) =>
    request<Supplier>(
      `/schools/${schoolId}/suppliers`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listRequisitions: (token: string, schoolId: number) => request<Requisition[]>(`/schools/${schoolId}/requisitions`, {}, token),

  createRequisition: (
    token: string,
    schoolId: number,
    payload: { department: string; account_id: number; description: string; quantity: number; unit_cost: number }
  ) =>
    request<Requisition>(
      `/schools/${schoolId}/requisitions`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  approveRequisition: (token: string, schoolId: number, id: number) =>
    request<Requisition>(`/schools/${schoolId}/requisitions/${id}/approve`, { method: "POST" }, token),

  declineRequisition: (token: string, schoolId: number, id: number) =>
    request<Requisition>(`/schools/${schoolId}/requisitions/${id}/decline`, { method: "POST" }, token),

  listPurchaseOrders: (token: string, schoolId: number) => request<PurchaseOrder[]>(`/schools/${schoolId}/purchase-orders`, {}, token),

  issuePurchaseOrder: (token: string, schoolId: number, payload: { requisition_id: number; supplier_id: number; delivery_date: string }) =>
    request<PurchaseOrder>(
      `/schools/${schoolId}/purchase-orders`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  receivePurchaseOrder: (token: string, schoolId: number, id: number) =>
    request<PurchaseOrder>(`/schools/${schoolId}/purchase-orders/${id}/receive`, { method: "POST" }, token),

  cancelPurchaseOrder: (token: string, schoolId: number, id: number) =>
    request<PurchaseOrder>(`/schools/${schoolId}/purchase-orders/${id}/cancel`, { method: "POST" }, token),

  listBudgets: (token: string, schoolId: number, year: number) =>
    request<BudgetLine[]>(`/schools/${schoolId}/budgets?year=${year}`, {}, token),

  listStockItems: (token: string, schoolId: number) => request<StockItem[]>(`/schools/${schoolId}/stores/items`, {}, token),

  createStockItem: (
    token: string,
    schoolId: number,
    payload: { name: string; category: string; unit: string; reorder_level: number; unit_cost: number; account_id: number }
  ) =>
    request<StockItem>(
      `/schools/${schoolId}/stores/items`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listStockMovements: (token: string, schoolId: number, itemId?: number) => {
    const qs = itemId ? `?item_id=${itemId}` : "";
    return request<StockMovement[]>(`/schools/${schoolId}/stores/movements${qs}`, {}, token);
  },

  receiveStock: (token: string, schoolId: number, payload: { item_id: number; quantity: number; unit_cost?: number; note?: string }) =>
    request<StockMovement>(
      `/schools/${schoolId}/stores/receipts`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listPayrollProfiles: (token: string, schoolId: number) => request<PayrollProfile[]>(`/schools/${schoolId}/payroll/profiles`, {}, token),

  createPayrollProfile: (
    token: string,
    schoolId: number,
    payload: { user_id: number; employment_type: EmploymentType; basic_salary: number; house_allowance?: number; transport_allowance?: number; kra_pin: string; nssf_number: string; bank_name?: string; bank_account?: string }
  ) =>
    request<PayrollProfile>(
      `/schools/${schoolId}/payroll/profiles`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  listPayRuns: (token: string, schoolId: number) => request<PayRun[]>(`/schools/${schoolId}/payroll/runs`, {}, token),

  createPayRun: (token: string, schoolId: number, period: string) =>
    request<PayRun>(
      `/schools/${schoolId}/payroll/runs`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period }) },
      token
    ),

  listFixedAssets: (token: string, schoolId: number) => request<FixedAsset[]>(`/schools/${schoolId}/assets`, {}, token),

  createFixedAsset: (
    token: string,
    schoolId: number,
    payload: { name: string; account_id: number; acquisition_date: string; cost: number; residual_value?: number; useful_life_years: number }
  ) =>
    request<FixedAsset>(
      `/schools/${schoolId}/assets`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  disposeFixedAsset: (token: string, schoolId: number, assetId: number) =>
    request<FixedAsset>(`/schools/${schoolId}/assets/${assetId}/dispose`, { method: "POST" }, token),

  listDepreciationRuns: (token: string, schoolId: number) => request<DepreciationRun[]>(`/schools/${schoolId}/assets/depreciation-runs`, {}, token),

  runDepreciation: (token: string, schoolId: number, period: string) =>
    request<DepreciationRun>(
      `/schools/${schoolId}/assets/depreciation-runs`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period }) },
      token
    ),

  payRun: (token: string, schoolId: number, runId: number) =>
    request<PayRun>(`/schools/${schoolId}/payroll/runs/${runId}/pay`, { method: "POST" }, token),

  issueStock: (token: string, schoolId: number, payload: { item_id: number; quantity: number; department: string; note?: string }) =>
    request<StockMovement>(
      `/schools/${schoolId}/stores/issues`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  setBudget: (token: string, schoolId: number, payload: { account_id: number; year: number; amount: number }) =>
    request<BudgetLine>(
      `/schools/${schoolId}/budgets`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),

  updateSupplier: (
    token: string,
    schoolId: number,
    supplierId: number,
    payload: Partial<{ name: string; category: string; phone: string; email: string; bank_account: string; etims_registered: boolean; is_active: boolean }>
  ) =>
    request<Supplier>(
      `/schools/${schoolId}/suppliers/${supplierId}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
      token
    ),
};

export { ApiError };
