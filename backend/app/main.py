import logging
from pathlib import Path

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core import scheduler
from app.core.config import settings
from app.core.database import Base, engine
from app.core.logging import configure_logging

configure_logging()

if settings.sentry_dsn:
    try:
        sentry_sdk.init(dsn=settings.sentry_dsn, environment=settings.environment, traces_sample_rate=0.2)
    except Exception:
        # A bad DSN should degrade to "no error tracking", never take the
        # whole backend down at boot.
        logging.getLogger(__name__).exception("Failed to initialize Sentry — continuing without it")
from app.routers import (
    academic_terms,
    academics,
    activities,
    analytics,
    asset,
    attendance,
    audit,
    auth,
    awards,
    boarding,
    budget,
    calendar_events,
    communication,
    dashboard,
    exams,
    fees,
    finance,
    homework,
    leads,
    ledger,
    lesson_plans,
    live_classes,
    meals,
    notifications,
    payments,
    payroll,
    pickup_dropoff,
    plans,
    portal,
    procurement,
    results,
    schools,
    security,
    staff_attendance,
    store,
    supplier,
    supervisors,
    teaching,
    timetable,
    transport,
    trip,
)

app = FastAPI(title="Milai Group of Schools API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(schools.router)
app.include_router(academics.router)
app.include_router(attendance.router)
app.include_router(results.router)
app.include_router(fees.router)
app.include_router(communication.router)
app.include_router(live_classes.router)
app.include_router(live_classes.public_router)
app.include_router(portal.router)
app.include_router(audit.router)
app.include_router(teaching.router)
app.include_router(notifications.router)
app.include_router(academic_terms.router)
app.include_router(transport.router)
app.include_router(payments.router)
app.include_router(meals.router)
app.include_router(awards.router)
app.include_router(activities.router)
app.include_router(analytics.router)
app.include_router(finance.router)
app.include_router(pickup_dropoff.router)
app.include_router(exams.router)
app.include_router(plans.router)
app.include_router(lesson_plans.router)
app.include_router(leads.router)
app.include_router(calendar_events.router)
app.include_router(dashboard.router)
app.include_router(boarding.router)
app.include_router(security.router)
app.include_router(trip.router)
app.include_router(ledger.router)
app.include_router(supplier.router)
app.include_router(procurement.router)
app.include_router(budget.router)
app.include_router(store.router)
app.include_router(payroll.router)
app.include_router(asset.router)
app.include_router(timetable.router)
app.include_router(staff_attendance.router)
app.include_router(supervisors.router)
app.include_router(homework.router)

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.on_event("startup")
def on_startup():
    # Dev convenience: create tables if they don't exist. Alembic migrations
    # take over once the schema stabilizes.
    Base.metadata.create_all(bind=engine)
    scheduler.start()


@app.get("/health")
def health():
    return {"status": "ok"}
