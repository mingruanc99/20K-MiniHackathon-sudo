# app/modules/generator/prosody.py
"""
Module 3B: Prosody & Pause Planner
Pre-TTS Instructional Intent Layer.
Plans pauses and prosodic inflections based on cognitive load and pedagogical structure.
Outputs fully compliant W3C SSML.
"""
import re
import uuid
from typing import List, Tuple
from app.models.blueprint import SectionPlan
from app.models.config import PipelineConfig
from app.models.expression import ProsodyPlan, SentenceProsody, WordPause, PauseType

class ProsodyPausePlanner:
    def __init__(self):
        # Known technical keywords for pre-emphasis pauses
        self.technical_keywords = {
            "convolution", "kernel", "filter", "stride", "padding",
            "pooling", "max pooling", "feature map", "activation", "relu",
            "flattening", "spatial locality", "translation invariance",
            "trainable parameters", "tensor", "backpropagation", "gradient",
            "matrix", "convolutional neural network", "dense layer", "mlp"
        }

    def plan_prosody(
        self,
        narration_text: str,
        plan: SectionPlan,
        config: PipelineConfig
    ) -> ProsodyPlan:
        wpm = config.presentation.baseline_wpm
        sentences_raw = self._split_into_sentences(narration_text)
        
        sentence_prosodies: List[SentenceProsody] = []
        total_words = 0
        total_speaking_sec = 0.0
        total_pause_ms = 0
        ssml_sentences = []

        total_sentences = len(sentences_raw)

        for s_idx, s_text in enumerate(sentences_raw, start=1):
            s_words = s_text.split()
            word_count = len(s_words)
            total_words += word_count

            # Determine prosody dynamics based on pedagogical role
            pitch, rate = self._determine_sentence_prosody(plan.pedagogical_function, s_idx, total_sentences)
            
            # Rate factor adjustment for speaking time estimation
            rate_factor = 1.0
            if rate == "slow":
                rate_factor = 1.15
            elif rate == "fast":
                rate_factor = 0.9

            s_speaking_sec = (word_count / (wpm / 60.0)) * rate_factor

            # Plan pauses for this sentence
            pauses, ssml_sentence = self._plan_sentence_pauses(
                s_text,
                is_last_sentence=(s_idx == total_sentences),
                pedagogical_role=plan.pedagogical_function
            )

            s_pause_ms = sum(p.duration_ms for p in pauses)
            total_pause_ms += s_pause_ms
            total_speaking_sec += s_speaking_sec

            sentence_prosodies.append(SentenceProsody(
                sentence_id=f"{plan.section_id}_s{s_idx:02d}",
                text=s_text,
                pitch=pitch,
                rate=rate,
                volume="medium",
                pauses=pauses,
                ssml=f'<prosody rate="{rate}" pitch="{pitch}">{ssml_sentence}</prosody>',
                estimated_speaking_time_sec=round(s_speaking_sec, 2),
                estimated_pause_time_sec=round(s_pause_ms / 1000.0, 2)
            ))
            ssml_sentences.append(f'<prosody rate="{rate}" pitch="{pitch}">{ssml_sentence}</prosody>')

        total_pause_sec = total_pause_ms / 1000.0
        effective_duration = total_speaking_sec + total_pause_sec

        full_ssml = (
            f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="{config.learner.language}">\n'
            + "\n".join(f"  {s}" for s in ssml_sentences) + "\n"
            + "</speak>"
        )

        return ProsodyPlan(
            section_id=plan.section_id,
            sentences=sentence_prosodies,
            total_words=total_words,
            total_speaking_sec=round(total_speaking_sec, 2),
            total_pause_sec=round(total_pause_sec, 2),
            effective_scene_duration_sec=round(effective_duration, 2),
            ssml_full=full_ssml
        )

    def _split_into_sentences(self, text: str) -> List[str]:
        # Split on sentence terminals .!? followed by whitespace or end of string
        parts = re.split(r'(?<=[.!?])\s+', text.strip())
        return [p.strip() for p in parts if p.strip()]

    def _determine_sentence_prosody(self, role: str, idx: int, total: int) -> Tuple[str, str]:
        if role == "hook":
            return "medium", "medium"
        elif role == "mechanism":
            return "medium", "slow"
        elif role == "summary":
            return "medium", "medium"
        elif role == "example":
            return "medium", "medium"
        return "medium", "medium"

    def _plan_sentence_pauses(
        self,
        sentence_text: str,
        is_last_sentence: bool,
        pedagogical_role: str
    ) -> Tuple[List[WordPause], str]:
        tokens = sentence_text.split()
        pauses: List[WordPause] = []
        ssml_tokens = []
        p_idx = 1

        for i, token in enumerate(tokens):
            clean_token = token.strip(".,;:()[]{}'\"").lower()
            
            # Check 1: Emphasis-pause (Pre-Keyword Focus) - 350-500ms
            if clean_token in self.technical_keywords and i > 0:
                p_id = f"p_emp_{uuid.uuid4().hex[:4]}"
                pause = WordPause(
                    pause_id=p_id,
                    pause_type="Emphasis-pause (Pre-Keyword Focus)",
                    after_word=tokens[i - 1],
                    word_index=i - 1,
                    duration_ms=400,
                    justification=f"Pre-emphasis focus before technical concept '{token}'"
                )
                pauses.append(pause)
                ssml_tokens.append(f'<break time="400ms"/>')

            ssml_tokens.append(token)

            # Check 2: Micro-pause (Syntactic Chunking) - 200-300ms after commas/semicolons
            if token.endswith((",", ";", ":", "—")):
                p_id = f"p_mic_{uuid.uuid4().hex[:4]}"
                pause = WordPause(
                    pause_id=p_id,
                    pause_type="Micro-pause (Syntactic Chunking)",
                    after_word=token,
                    word_index=i,
                    duration_ms=250,
                    justification="Syntactic boundary chunking for cognitive clarity"
                )
                pauses.append(pause)
                ssml_tokens.append(f'<break time="250ms"/>')

        # Check 3: Terminal sentence pause
        if is_last_sentence:
            # Transition-pause (Inter-Scene Boundary) - 1200ms
            p_id = f"p_trn_{uuid.uuid4().hex[:4]}"
            pause = WordPause(
                pause_id=p_id,
                pause_type="Transition-pause (Inter-Scene Boundary)",
                after_word=tokens[-1] if tokens else "",
                word_index=len(tokens) - 1,
                duration_ms=1200,
                justification="Inter-scene boundary pause allowing scene transition consolidation"
            )
            pauses.append(pause)
            ssml_tokens.append(f'<break time="1200ms"/>')
        else:
            # Cognitive-pause (Post-Concept Processing) - 700ms
            p_id = f"p_cog_{uuid.uuid4().hex[:4]}"
            pause = WordPause(
                pause_id=p_id,
                pause_type="Cognitive-pause (Post-Concept Processing)",
                after_word=tokens[-1] if tokens else "",
                word_index=len(tokens) - 1,
                duration_ms=750,
                justification="Sentence-level cognitive assimilation pause"
            )
            pauses.append(pause)
            ssml_tokens.append(f'<break time="750ms"/>')

        return pauses, " ".join(ssml_tokens)
