from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SampleDataRow(Base):
    """One row the sample-data generator created for a school. Removing a school's sample data deletes exactly these,
    newest first, so anything a school typed in by hand is never touched."""

    __tablename__ = "sample_data_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), index=True, nullable=False)
    seq: Mapped[int] = mapped_column(Integer, nullable=False)
    table_name: Mapped[str] = mapped_column(String(80), nullable=False)
    row_id: Mapped[int] = mapped_column(Integer, nullable=False)
