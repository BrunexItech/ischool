"""A tiny, dependency-free PDF writer, enough for sample worksheets and exam papers."""

from pathlib import Path

from app.core.config import settings
from app.core.uploads import UPLOAD_ROOT


def _esc(t: str) -> str:
    return t.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def make_pdf(title: str, lines: list[str]) -> bytes:
    content = ["BT", "/F1 18 Tf", "56 790 Td", f"({_esc(title)}) Tj", "/F1 11 Tf", "0 -30 Td", "16 TL"]
    for line in lines[:42]:
        content.append(f"({_esc(line[:92])}) '")
    content.append("ET")
    stream = "\n".join(content).encode("latin-1", "replace")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = bytearray(b"%PDF-1.4\n"), []
    for i, o in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def save_sample_pdf(school_id: int, folder: str, name: str, title: str, lines: list[str]) -> str | None:
    """Writes the PDF under uploads and returns the public address, or None if the disk will not take it."""
    try:
        rel = f"schools/{school_id}/sample/{folder}/{name}.pdf"
        path: Path = UPLOAD_ROOT / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(make_pdf(title, lines))
        return f"{settings.backend_url}/uploads/{rel}"
    except OSError:
        return None
