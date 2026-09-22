# app/modules/extractor/factory.py
"""
Factory for instantiating the correct extractor based on file extension.
Zero-LLM/VLM guarantee, <50ms extraction, zero API calls.
"""
from pathlib import Path
from typing import Union
from app.models.document import CanonicalDocumentTree
from app.modules.extractor.base import BaseExtractor
from app.modules.extractor.pptx_extractor import PPTXExtractor
from app.modules.extractor.docx_extractor import DOCXExtractor
from app.modules.extractor.md_extractor import MarkdownExtractor
from app.modules.extractor.pdf_extractor import PDFExtractor

def extract_document(source: Union[str, Path, bytes], filename: str) -> CanonicalDocumentTree:
    ext = Path(filename).suffix.lower()
    
    if ext in [".pptx", ".ppt"]:
        extractor: BaseExtractor = PPTXExtractor()
    elif ext in [".pdf"]:
        extractor = PDFExtractor()
    elif ext in [".docx", ".doc"]:
        extractor = DOCXExtractor()
    elif ext in [".md", ".markdown", ".txt"]:
        extractor = MarkdownExtractor()
    else:
        # Default to markdown/text extractor
        extractor = MarkdownExtractor()

    return extractor.extract(source, filename)
