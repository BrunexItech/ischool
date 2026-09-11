from app.models.school import School
from app.models.module import SchoolModule, MODULE_KEYS
from app.models.user import User, UserRole
from app.models.academics import SchoolClass, Student, StaffProfile
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.results import Subject, Result
from app.models.fees import FeeInvoice, FeePayment
from app.models.communication import Announcement, AnnouncementAudience

__all__ = [
    "School",
    "SchoolModule",
    "MODULE_KEYS",
    "User",
    "UserRole",
    "SchoolClass",
    "Student",
    "StaffProfile",
    "AttendanceRecord",
    "AttendanceStatus",
    "Subject",
    "Result",
    "FeeInvoice",
    "FeePayment",
    "Announcement",
    "AnnouncementAudience",
]
