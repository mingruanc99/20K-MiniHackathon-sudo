# app/modules/extractor/base.py
"""
Abstract base class for rule-based document extractors.
CLSG-IR Module 1 Guarantee: Zero-LLM, Zero-VLM, deterministic structural extraction.
"""
import re
import unicodedata
from abc import ABC, abstractmethod
from typing import Union
from pathlib import Path
from app.models.document import CanonicalDocumentTree

BULLET_REGEX_PATTERN = r'[•\-\*·■□▪▫●◆▶◄►‣⁃∙\u25A0-\u25FF\uE000-\uF8FF\uFFFD]'

def normalize_text_and_symbols(raw_text: str) -> str:
    if not raw_text:
        return ""
    # NFC
    text = unicodedata.normalize('NFC', raw_text)
    # Remove control characters
    text = re.sub(r'[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\uFEFF\u00AD\uFFFC]', '', text)
    # Convert ranges like ■ 1^-4 or 1^-4 to 1–4:
    bullet_chars = r'[■□▪▫▬▭▮▯▲▼▶◄►◆◇●○◉◘◙⦿★☆✦✧✨‣⁃∙·\u25A0-\u25FF\uE000-\uF8FF\uFFFD]'
    text = re.sub(rf'(?:{bullet_chars}\s*)?(\b\d+)\s*\^[-–—~]\s*(\d+\b)(?:\s*[:\-])?', r'\1–\2:', text)
    text = re.sub(r'(\b\d+)\s*\^[-–—~]\s*(\d+\b)', r'\1–\2', text)
    # Strip remaining bullets
    text = re.sub(rf'^{bullet_chars}+\s*', '', text, flags=re.MULTILINE)
    text = re.sub(rf'([,;:.]\s*){bullet_chars}+\s*', r'\1', text)
    text = re.sub(rf'\s*{bullet_chars}+\s*', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

class BaseExtractor(ABC):
    @abstractmethod
    def extract(self, source: Union[str, Path, bytes], filename: str) -> CanonicalDocumentTree:
        """Extract canonical document tree from file path or bytes."""
        pass
