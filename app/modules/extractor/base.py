# app/modules/extractor/base.py
"""
Abstract base class for rule-based document extractors.
CLSG-IR Module 1 Guarantee: Zero-LLM, Zero-VLM, deterministic structural extraction.
"""
from abc import ABC, abstractmethod
from typing import Union
from pathlib import Path
from app.models.document import CanonicalDocumentTree

class BaseExtractor(ABC):
    @abstractmethod
    def extract(self, source: Union[str, Path, bytes], filename: str) -> CanonicalDocumentTree:
        """Extract canonical document tree from file path or bytes."""
        pass
