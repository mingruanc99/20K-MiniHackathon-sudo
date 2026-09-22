# app/core/terminology.py
"""
Technical Terminology Service for Python backend & CLI.
Implements Vietnamese-First Narration with English Technical Terminology Preservation.
"""
import json
import os
import re
from typing import Dict, List, Any, Optional, Tuple

class TechnicalTerminologyService:
    _instance = None

    def __init__(self, config_path: Optional[str] = None):
        if not config_path:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            config_path = os.path.join(base_dir, "config", "technical_terms.json")
        
        self.terms_map: Dict[str, Dict[str, Any]] = {}
        self.awkward_map: Dict[str, str] = {}
        self.unnecessary_english_map: Dict[str, str] = {}
        self.canonical_keys_sorted: List[str] = []

        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                terms = data.get("terms", {})
                for k, v in terms.items():
                    self.terms_map[k.lower()] = v
                self.canonical_keys_sorted = sorted(list(self.terms_map.keys()), key=len, reverse=True)
                self.awkward_map = {k.lower(): v for k, v in data.get("vietnamese_awkward_translations", {}).items()}
                self.unnecessary_english_map = {k.lower(): v for k, v in data.get("unnecessary_english_verbs_and_words", {}).items()}

    @classmethod
    def get_instance(cls) -> "TechnicalTerminologyService":
        if cls._instance is None:
            cls._instance = TechnicalTerminologyService()
        return cls._instance

    def get_system_prompt_guidance(self) -> str:
        return (
            "You are generating educational narration for a Vietnamese learner.\n"
            "Write the narration primarily in natural Vietnamese.\n"
            "Preserve established English technical terminology when appropriate (e.g., CNN, kernel, feature map, pooling, spatial dimensions, bounding box, IoU, Transformer).\n"
            "Do not translate technical terms literally into awkward Vietnamese.\n"
            "Do not use English verbs or adjectives unnecessarily (e.g., use 'quét' instead of 'scan', use 'giảm' instead of 'reduce').\n"
            "The result should sound like a Vietnamese AI lecturer explaining a technical concept naturally.\n"
            "Use: Vietnamese sentence structure + English technical terminology."
        )

    def resolve_and_preserve_sentence(self, sentence: str) -> Tuple[str, List[str], List[str]]:
        resolved = sentence
        preserved: List[str] = []
        normalized: List[str] = []

        # 1. Awkward translations
        for awkward, canonical in self.awkward_map.items():
            pattern = rf"\b{re.escape(awkward)}\b"
            if re.search(pattern, resolved, re.IGNORECASE):
                resolved = re.sub(pattern, canonical, resolved, flags=re.IGNORECASE)
                normalized.append(f"{awkward} -> {canonical}")

        # 2. Canonical terms
        for key in self.canonical_keys_sorted:
            pattern = rf"\b{re.escape(key)}\b"
            if re.search(pattern, resolved, re.IGNORECASE):
                canonical = self.terms_map[key].get("canonical", key)
                resolved = re.sub(pattern, canonical, resolved, flags=re.IGNORECASE)
                if canonical not in preserved:
                    preserved.append(canonical)

        # 3. Unnecessary English verbs/words
        for eng, vi in self.unnecessary_english_map.items():
            pattern = rf"\b{re.escape(eng)}\b"
            if re.search(pattern, resolved, re.IGNORECASE):
                is_part_of_term = any(eng in p.lower() for p in preserved)
                if not is_part_of_term:
                    resolved = re.sub(pattern, vi, resolved, flags=re.IGNORECASE)

        return resolved, preserved, normalized
