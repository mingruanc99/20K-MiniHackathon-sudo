# app/modules/guard/cost_guard.py
"""
Subsystem D: System & Cost Evaluation, Budget Guard, and Latency Tracker
Calculates:
- Tail latency distributions (P50, P95, P99)
- Token economics & cost tracking
- User tier budget policy enforcement (NORMAL vs VIP)
"""
import numpy as np
from typing import List, Dict, Any, Tuple
from app.models.evaluation import UserTierType, BudgetPolicy, SystemPerformanceMetrics

DEFAULT_BUDGET_POLICIES: Dict[UserTierType, BudgetPolicy] = {
    "NORMAL": BudgetPolicy(
        tier="NORMAL",
        max_token_budget_per_generation=8000,
        daily_cost_limit_usd=5.0,
        allowed_models=["gemini-2.5-flash-lite", "gemini-2.5-flash"],
        rate_limit_per_minute=10
    ),
    "VIP": BudgetPolicy(
        tier="VIP",
        max_token_budget_per_generation=32000,
        daily_cost_limit_usd=50.0,
        allowed_models=["gemini-2.5-flash", "gemini-2.5-pro", "qwen-max"],
        rate_limit_per_minute=60
    )
}

class CostAndBudgetGuard:
    def __init__(self, policies: Dict[UserTierType, BudgetPolicy] = None):
        self.policies = policies or DEFAULT_BUDGET_POLICIES
        self.latency_history: List[float] = []
        self.user_spend_registry: Dict[str, float] = {}

    def check_budget_limit(
        self,
        user_id: str,
        user_tier: UserTierType,
        estimated_tokens: int
    ) -> Tuple[bool, str]:
        policy = self.policies.get(user_tier, self.policies["NORMAL"])

        # Token ceiling check
        if estimated_tokens > policy.max_token_budget_per_generation:
            return False, f"Estimated tokens ({estimated_tokens}) exceed tier {user_tier} limit ({policy.max_token_budget_per_generation})."

        # Daily cost spend ceiling check
        current_spend = self.user_spend_registry.get(user_id, 0.0)
        if current_spend >= policy.daily_cost_limit_usd:
            return False, f"User daily spend (${current_spend:.2f}) reached tier {user_tier} ceiling (${policy.daily_cost_limit_usd:.2f})."

        return True, "Within budget boundaries."

    def record_generation_metrics(
        self,
        generation_id: str,
        user_id: str,
        user_tier: UserTierType,
        latency_ms: float,
        input_tokens: int,
        output_tokens: int,
        cache_hit: bool = False
    ) -> SystemPerformanceMetrics:
        self.latency_history.append(latency_ms)

        # Standard blended token pricing (approx. $0.075 / 1M input, $0.30 / 1M output for flash-tier)
        cost_usd = ((input_tokens * 0.000000075) + (output_tokens * 0.00000030)) if not cache_hit else 0.0
        self.user_spend_registry[user_id] = self.user_spend_registry.get(user_id, 0.0) + cost_usd

        p50, p95, p99 = self.calculate_latency_percentiles()

        return SystemPerformanceMetrics(
            generation_id=generation_id,
            p50_latency_ms=round(p50, 1),
            p95_latency_ms=round(p95, 1),
            p99_latency_ms=round(p99, 1),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            cost_usd=round(cost_usd, 6),
            user_tier=user_tier,
            cache_hit=cache_hit
        )

    def calculate_latency_percentiles(self) -> Tuple[float, float, float]:
        if not self.latency_history:
            return 0.0, 0.0, 0.0
        arr = sorted(self.latency_history)
        p50 = float(np.percentile(arr, 50))
        p95 = float(np.percentile(arr, 95))
        p99 = float(np.percentile(arr, 99))
        return p50, p95, p99
