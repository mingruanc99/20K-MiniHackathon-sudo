# app/modules/extractor/base.py
"""
Abstract base class and Unicode normalization utilities for rule-based document extractors.
Guarantees:
- Zero loss of Unicode punctuation: em-dash (—), en-dash (–), minus (−), hyphen (-), ellipsis (…), curly quotes, arrows.
- Full preservation of numeric ranges (1–4, 5–10, 11–16).
- Preserves both raw_text and normalized_text with NFC normalization.
- Zero-LLM, Zero-VLM deterministic structural extraction.
"""
import re
import unicodedata
from abc import ABC, abstractmethod
from typing import Union, Tuple, Optional
from pathlib import Path
from app.models.document import CanonicalDocumentTree

# Dedicated bullet glyphs (EXCLUDING dashes/hyphens so numeric ranges and dashes are never mangled)
BULLET_GLYPHS = r'[•\*·■□▪▫●◆◇▲▼▶◄►‣⁃∙\u25A0-\u25FF\uE000-\uF8FF\uFFFD]'
BULLET_REGEX_PATTERN = rf'(?:{BULLET_GLYPHS}|\([a-zA-Z0-9]+\)|\d+\.)'

def normalize_text_and_symbols(raw_text: str) -> str:
    """
    Normalizes text using Unicode NFC while strictly preserving:
    - Em-dash (—), En-dash (–), Minus (−), Hyphen (-)
    - Numeric ranges (e.g. '1–4', '5–10', '11–16')
    - Vietnamese diacritics and curly quotes
    - Ellipses and arrows
    """
    if not raw_text:
        return ""

    # 1. NFC Unicode normalization (canonical composition)
    text = unicodedata.normalize('NFC', raw_text)

    # 2. Strip non-printable and invisible control characters, preserving newlines, tabs, and all punctuation
    text = re.sub(r'[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\uFEFF\u00AD\uFFFC]', '', text)

    # 3. Clean up superscripts like 1^-4 or 1^–4 into standard en-dash range '1–4'
    text = re.sub(r'(\b\d+)\s*\^[-–—~]\s*(\d+\b)', r'\1–\2', text)

    # 4. Collapse multiple spaces into single space while preserving intentional text
    text = re.sub(r'[ \t]+', ' ', text).strip()

    return text

def parse_list_item(text: str) -> Tuple[bool, Optional[str], str]:
    """
    Detects if a string is a bullet/list item.
    Returns (is_list_item, marker, clean_text).
    Guarantees:
    - Does NOT strip digits from numeric ranges like '1–4' or '5–10' or '0 nose — mũi'.
    """
    if not text:
        return False, None, ""

    # Match bullet glyph at start: e.g. '■ 0 nose — mũi' or '• 1–4 ...'
    bullet_match = re.match(rf'^({BULLET_GLYPHS})\s*(.*)$', text)
    if bullet_match:
        marker = bullet_match.group(1)
        content = bullet_match.group(2).strip()
        return True, marker, content

    # Match ordered numbering like '1.' or '(a)' followed strictly by space
    ordered_match = re.match(r'^(\d+\.|\([a-zA-Z0-9]+\))\s+(.*)$', text)
    if ordered_match:
        marker = ordered_match.group(1)
        content = ordered_match.group(2).strip()
        return True, marker, content

    # Plain hyphen as bullet only if followed by space and NOT a numeric range
    hyphen_match = re.match(r'^[-–]\s+([^\d].*)$', text)
    if hyphen_match:
        return True, "-", hyphen_match.group(1).strip()

    return False, None, text

class BaseExtractor(ABC):
    @abstractmethod
    def extract(self, source: Union[str, Path, bytes], filename: str) -> CanonicalDocumentTree:
        """Extract canonical document tree from file path or bytes."""
        pass
