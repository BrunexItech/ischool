const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type UserRole = "super_admin" | "school_admin" | "teacher" | "staff" | "student" | "parent";

export interface User {
  id: number;
  school_id: number | null;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
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
    }
  ) => request<School>("/schools", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, token),

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
    payload: { student_id: number; term: string; amount_due: number; due_date?: string }
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
    payload: { title: string; body: string; audience: AnnouncementAudience; class_id?: number }
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
};

export { ApiError };
