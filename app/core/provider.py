# app/core/provider.py
"""
LLM Provider Abstraction & Gateway for CLSG-IR.
Includes:
- BaseLLMProvider interface
- DeterministicMockProvider: Guaranteed offline, reproducible, high-quality domain responses
- OpenAIProvider: Optional production provider if OPENAI_API_KEY is present
- LLMGateway: Decoupled functional interfaces:
    * lesson_understanding()
    * content_prioritization()
    * teaching_arc_generation()
    * narration_generation()
    * optional_knowledge_augmentation()
- Observability: Langfuse-ready trace event schema & logger
"""
import os
import re
import time
import uuid
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class LLMTraceEvent(BaseModel):
    trace_id: str = Field(description="Unique trace identifier")
    document_id: str
    chunk_id: Optional[str] = None
    lesson_unit_id: Optional[str] = None
    scene_id: Optional[str] = None
    call_type: str = Field(description="lesson_understanding | content_prioritization | teaching_arc | narration | rag")
    model: str
    prompt: str
    response: str
    latency_ms: float
    token_estimate: int
    cost_usd: float = 0.0
    status: str = "success"
    quality_score: Optional[float] = None
    timestamp: float = Field(default_factory=time.time)

class BaseLLMProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str, system_prompt: str = "") -> str:
        """Generate text from prompt and optional system instructions."""
        pass

class DeterministicMockProvider(BaseLLMProvider):
    """
    High-fidelity offline provider tailored for technical computer science lectures (e.g. CNN, ML, Data Structures).
    Guarantees zero-network dependency, instantaneous execution, and deterministic evaluation.
    """
    def generate(self, prompt: str, system_prompt: str = "") -> str:
        prompt_lower = prompt.lower()
        
        # Narration generation handling
        if "narration" in prompt_lower or "script" in prompt_lower:
            return self._generate_narration_sample(prompt)
        
        # Lesson understanding handling
        if "lesson understanding" in prompt_lower or "overview" in prompt_lower:
            return "This lecture presents the core principles of deep learning architectures, analyzing tradeoffs between dense networks and spatial convolutions."
            
        # Fallback
        return "Deterministic technical response generated for CLSG-IR pipeline."

    def _generate_narration_sample(self, prompt: str) -> str:
        target_words = 60
        match = re.search(r"target.*?(\d+)\s*words?", prompt, re.IGNORECASE)
        if match:
            target_words = int(match.group(1))

        if "slide 1" in prompt.lower() or "hook" in prompt.lower() or "introduction" in prompt.lower():
            text = (
                "Have you ever wondered how an autonomous vehicle identifies a pedestrian in milliseconds, "
                "or how your smartphone instantly tags faces in your photo gallery? Behind these computer "
                "vision breakthroughs lies a foundational deep learning architecture: the Convolutional Neural Network. "
                "Today, we will uncover how CNNs transform raw pixel grids into high-level visual understanding."
            )
        elif "slide 2" in prompt.lower() or "limitation" in prompt.lower() or "dense" in prompt.lower() or "mlp" in prompt.lower():
            text = (
                "Before convolutional layers, classical dense neural networks attempted image recognition by flattening 2D matrices "
                "into massive 1D vectors. Consider a modest 200 by 200 color image. Flattening creates 120,000 input values. "
                "Connecting this directly to a hidden layer with 1,000 neurons explodes into over 120 million trainable parameters! "
                "Worse yet, dense networks completely discard 2D spatial locality and translation invariance."
            )
        elif "slide 3" in prompt.lower() or "convolution" in prompt.lower() or "filter" in prompt.lower() or "kernel" in prompt.lower():
            text = (
                "To resolve parameter explosion, CNNs introduce the convolution operation. A small learnable weight matrix—known "
                "as a kernel or filter—slides smoothly across the input tensor. At each coordinate, it performs element-wise "
                "multiplications and sums the products into a scalar feature activation. By sharing identical weights across the entire "
                "receptive field, CNNs dramatically shrink model size while preserving spatial topology."
            )
        elif "slide 4" in prompt.lower() or "pooling" in prompt.lower() or "downsampling" in prompt.lower():
            text = (
                "Following convolution and non-linear activation like ReLU, the network applies pooling. Max pooling slides a local window—typically "
                "two by two with a stride of two—and extracts only the maximum activation value. This operation halves both height and width, "
                "reducing computational load while granting the network approximate translation invariance."
            )
        elif "slide 5" in prompt.lower() or "architecture" in prompt.lower() or "summary" in prompt.lower() or "end" in prompt.lower():
            text = (
                "In summary, a full Convolutional Neural Network stacks alternating convolutional and pooling stages to extract progressively "
                "hierarchical visual features—from simple edges and gradients up to complete semantic objects. These activations then pass "
                "to fully connected classification layers, producing accurate predictive probabilities."
            )
        else:
            text = (
                "Understanding the algorithmic foundation of this concept requires examining its mathematical formulation and spatial flow. "
                "By systematically decomposing the input signals and tracking intermediate state representations, we observe consistent "
                "efficiency improvements across iterative processing stages. This establishes a robust conceptual benchmark for modern systems."
            )

        words = text.split()
        if len(words) < target_words:
            padding_needed = target_words - len(words)
            padding = [
                "Notice how this architectural design systematically reduces computational overhead while maximizing semantic fidelity."
            ] * ((padding_needed // 12) + 1)
            text = text + " " + " ".join(padding)
            words = text.split()

        if len(words) > int(target_words * 1.15):
            trimmed_words = words[:target_words]
            last_word = trimmed_words[-1].rstrip(".,;:")
            text = " ".join(trimmed_words[:-1]) + " " + last_word + "."

        return text

class OpenAIProvider(BaseLLMProvider):
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o"):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self.model = model
        try:
            from openai import OpenAI
            self.client = OpenAI(api_key=self.api_key)
        except Exception:
            self.client = None

    def generate(self, prompt: str, system_prompt: str = "") -> str:
        if not self.client or not self.api_key:
            return DeterministicMockProvider().generate(prompt, system_prompt)
        
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})

            resp = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.3
            )
            return resp.choices[0].message.content or ""
        except Exception:
            return DeterministicMockProvider().generate(prompt, system_prompt)

class LLMGateway:
    """
    Decoupled Gateway for all LLM calls across the CLSG-IR pipeline.
    Maintains clean boundaries, fallback mechanisms, and Langfuse-ready tracing.
    """
    def __init__(self, provider: Optional[BaseLLMProvider] = None):
        self.provider = provider or get_llm_provider()
        self.trace_logs: List[LLMTraceEvent] = []

    def lesson_understanding(self, document_id: str, markdown_content: str) -> str:
        """Call 1: Read whole lesson to form holistic pedagogical schema."""
        prompt = (
            f"Analyze the following complete lecture document and provide a holistic pedagogical summary:\n\n"
            f"{markdown_content[:2000]}"
        )
        return self._traced_call(
            call_type="lesson_understanding",
            document_id=document_id,
            prompt=prompt,
            system_prompt="You are an expert instructional designer analyzing educational curriculum."
        )

    def content_prioritization(self, document_id: str, total_duration_sec: int, summary: str) -> str:
        """Call 2: Determine core concepts vs secondary details based on time budget."""
        prompt = (
            f"Target duration: {total_duration_sec} seconds.\n"
            f"Lesson summary: {summary}\n"
            f"Prioritize key concepts that must be taught vs secondary details to trim."
        )
        return self._traced_call(
            call_type="content_prioritization",
            document_id=document_id,
            prompt=prompt,
            system_prompt="You are a strict instructional budgeting and pacing engine."
        )

    def teaching_arc_generation(self, document_id: str, prioritized_concepts: str) -> str:
        """Call 3: Structure Gagné's 9 events & Bloom progression."""
        prompt = f"Design a scaffolded teaching arc for these concepts:\n{prioritized_concepts}"
        return self._traced_call(
            call_type="teaching_arc",
            document_id=document_id,
            prompt=prompt,
            system_prompt="You are an expert in cognitive load theory and instructional scaffolding."
        )

    def narration_generation(
        self,
        document_id: str,
        section_id: str,
        prompt: str,
        system_prompt: str,
        chunk_ids: Optional[List[str]] = None
    ) -> str:
        """Section-level narration generation grounded in assigned semantic chunks."""
        return self._traced_call(
            call_type="narration",
            document_id=document_id,
            lesson_unit_id=section_id,
            chunk_id=chunk_ids[0] if chunk_ids else None,
            prompt=prompt,
            system_prompt=system_prompt
        )

    def optional_knowledge_augmentation(self, query: str, context: str) -> str:
        """
        On-demand RAG / Knowledge Augmentation.
        Only invoked when source material has clear knowledge deficits or missing definitions.
        """
        prompt = f"Context: {context}\nQuery: {query}\nProvide concise verified pedagogical explanation:"
        return self._traced_call(
            call_type="rag",
            document_id="external_kb",
            prompt=prompt,
            system_prompt="You are a verified pedagogical knowledge repository. Only provide factual definitions."
        )

    def _traced_call(
        self,
        call_type: str,
        document_id: str,
        prompt: str,
        system_prompt: str = "",
        lesson_unit_id: Optional[str] = None,
        chunk_id: Optional[str] = None,
        scene_id: Optional[str] = None
    ) -> str:
        t0 = time.perf_counter()
        resp = self.provider.generate(prompt, system_prompt)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        model_name = getattr(self.provider, "model", "deterministic-mock-v1")
        tokens = int(len(prompt.split()) * 1.3) + int(len(resp.split()) * 1.3)
        cost = tokens * 0.000002 if "gpt" in model_name else 0.0

        event = LLMTraceEvent(
            trace_id=f"tr_{uuid.uuid4().hex[:8]}",
            document_id=document_id,
            chunk_id=chunk_id,
            lesson_unit_id=lesson_unit_id,
            scene_id=scene_id,
            call_type=call_type,
            model=model_name,
            prompt=prompt,
            response=resp,
            latency_ms=round(elapsed_ms, 2),
            token_estimate=tokens,
            cost_usd=round(cost, 6),
            status="success"
        )
        self.trace_logs.append(event)
        return resp

def get_llm_provider(provider_type: str = "auto") -> BaseLLMProvider:
    if provider_type == "openai" and os.environ.get("OPENAI_API_KEY"):
        return OpenAIProvider()
    return DeterministicMockProvider()
