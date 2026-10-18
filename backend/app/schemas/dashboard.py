from datetime import date, datetime

from pydantic import BaseModel


class AttendanceTrendPoint(BaseModel):
    date: date
    rate: float | None


class PendingRegister(BaseModel):
    class_id: int
    class_name: str
    teacher_name: str | None
    student_count: int


class TopBalance(BaseModel):
    student_id: int
    student_name: str
    admission_number: str
    class_name: str | None
    balance: float


class RecentActivityItem(BaseModel):
    action: str
    entity_type: str
    entity_id: int
    created_at: datetime
    actor_name: str | None


class DashboardSummaryOut(BaseModel):
    total_students: int
    total_staff: int
    active_staff: int
    amount_billed: float
    amount_paid: float
    fee_collection_rate: float
    today_attendance_rate: float | None
    yesterday_attendance_rate: float | None
    attendance_trend: list[AttendanceTrendPoint]
    classes_total: int
    classes_marked_today: int
    pending_registers: list[PendingRegister]
    top_balances: list[TopBalance]
    recent_activity: list[RecentActivityItem]


class GroupBranchSummary(BaseModel):
    school_id: int
    name: str
    is_group: bool
    total_students: int
    active_staff: int
    amount_billed: float
    amount_paid: float
    fee_collection_rate: float
    today_attendance_rate: float | None
    classes_total: int
    classes_marked_today: int


class GroupSummaryOut(BaseModel):
    group_id: int
    group_name: str
    rows: list[GroupBranchSummary]
    total_students: int
    total_active_staff: int
    total_amount_billed: float
    total_amount_paid: float
    overall_fee_collection_rate: float
