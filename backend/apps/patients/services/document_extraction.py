from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO


TEXT_EXTENSIONS = {
    ".txt",
    ".md",
    ".markdown",
    ".csv",
    ".json",
    ".yaml",
    ".yml",
    ".xml",
    ".log",
}

PDF_EXTENSIONS = {".pdf"}
PDF_MIME_TYPES = {"application/pdf", "application/x-pdf"}


@dataclass
class DocumentExtractionResult:
    status: str
    text: str = ""
    error: str = ""


def _extract_pdf_text(file_obj: BinaryIO) -> str:
    # OCR is intentionally not used; we only parse text that already exists in the PDF.
    from pypdf import PdfReader

    reader = PdfReader(file_obj)
    pages: list[str] = []
    for page in reader.pages:
        page_text = (page.extract_text() or "").strip()
        if page_text:
            pages.append(page_text)
    return "\n\n".join(pages).strip()


def _extract_plain_text(file_obj: BinaryIO) -> str:
    raw = file_obj.read()
    if isinstance(raw, str):
        return raw.strip()
    if not raw:
        return ""

    for encoding in ("utf-8-sig", "utf-8", "utf-16", "latin-1"):
        try:
            return raw.decode(encoding).strip()
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="replace").strip()


def extract_document_text(
    *,
    file_obj: BinaryIO,
    original_name: str,
    content_type: str | None,
) -> DocumentExtractionResult:
    extension = Path(original_name or "").suffix.lower()
    mime = (content_type or "").split(";")[0].strip().lower()

    is_pdf = extension in PDF_EXTENSIONS or mime in PDF_MIME_TYPES
    is_text = extension in TEXT_EXTENSIONS or mime.startswith("text/")

    if not is_pdf and not is_text:
        return DocumentExtractionResult(
            status="unsupported",
            error="Unsupported file type for text extraction.",
        )

    try:
        file_obj.seek(0)
        extracted = _extract_pdf_text(file_obj) if is_pdf else _extract_plain_text(file_obj)
    except Exception as exc:
        return DocumentExtractionResult(status="failed", error=str(exc))

    if not extracted:
        return DocumentExtractionResult(status="empty", error="No extractable text found.")

    return DocumentExtractionResult(status="extracted", text=extracted)


def is_supported_text_document(original_name: str, content_type: str | None) -> bool:
    extension = Path(original_name or "").suffix.lower()
    mime = (content_type or "").split(";")[0].strip().lower()

    is_pdf = extension in PDF_EXTENSIONS or mime in PDF_MIME_TYPES
    is_text = extension in TEXT_EXTENSIONS or mime.startswith("text/")

    return is_pdf or is_text
