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
};

export { ApiError };
