from fastapi import APIRouter
from fastapi.responses import Response

from app.seed.pdfs import build_worksheet

router = APIRouter(tags=["sample files"])


@router.get("/sample-worksheets/worksheet.pdf")
def sample_worksheet(subject: str = "Subject", grade: str = "", kind: str = "homework", title: str = ""):
    """The worksheets and papers that come with a school's sample data, written on request."""
    pdf = build_worksheet(subject[:80], grade[:40], "exam" if kind == "exam" else "homework", title[:120])
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": 'inline; filename="worksheet.pdf"'})
