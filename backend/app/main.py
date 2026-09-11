from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.routers import academics, attendance, auth, communication, fees, results, schools

app = FastAPI(title="iSchool API")

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


@app.on_event("startup")
def on_startup():
    # Dev convenience: create tables if they don't exist. Alembic migrations
    # take over once the schema stabilizes.
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}
