# app/modules/guard/security_guard.py
"""
Subsystem E: Privacy, Tenant Isolation & Prompt Injection Guardrail
Guarantees:
1. Retrieval Scope Control: User A strictly cannot access User B's documents, projects, or slides.
2. Prompt Injection & Scope Protection: Detects adversarial jailbreaks, system prompt leak attempts, and unauthorized data queries.
3. Security Event Logging: Audit trail for compliance without leaking sensitive payload data.
"""
import re
import uuid
from typing import Tuple, List, Optional
from app.models.evaluation import SecurityEvent

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions?",
    r"system\s*prompt\s*(reveal|leak|show|print)",
    r"show\s+me\s+(another|other)\s+user",
    r"select\s+\*\s+from\s+users?",
    r"give\s+me\s+private\s+database",
    r"bypass\s+(safety|guardrail|security)",
    r"jailbreak",
    r"override\s+system\s+role",
    r"access\s+token|secret_key|api_key"
]

class PrivacyAndSecurityGuard:
    def __init__(self):
        self.security_logs: List[SecurityEvent] = []
        self._compiled_patterns = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]

    def verify_tenant_access(
        self,
        requesting_user_id: str,
        resource_owner_id: str,
        project_id: Optional[str] = None
    ) -> Tuple[bool, Optional[SecurityEvent]]:
        """
        Enforces tenant isolation: User A cannot read or retrieve User B's assets.
        """
        if requesting_user_id != resource_owner_id:
            event = SecurityEvent(
                event_id=f"sec_{uuid.uuid4().hex[:8]}",
                user_id=requesting_user_id,
                project_id=project_id,
                event_type="TENANT_VIOLATION",
                severity="critical",
                detail=f"User '{requesting_user_id}' attempted cross-tenant access to resource owned by '{resource_owner_id}'.",
                blocked=True
            )
            self.security_logs.append(event)
            return False, event
        return True, None

    def screen_prompt_injection(
        self,
        prompt_text: str,
        user_id: str,
        project_id: Optional[str] = None
    ) -> Tuple[bool, Optional[SecurityEvent]]:
        """
        Scans input prompts for adversarial injection attempts or data exfiltration commands.
        """
        for pattern in self._compiled_patterns:
            if pattern.search(prompt_text):
                event = SecurityEvent(
                    event_id=f"sec_{uuid.uuid4().hex[:8]}",
                    user_id=user_id,
                    project_id=project_id,
                    event_type="PROMPT_INJECTION",
                    severity="high",
                    detail=f"Prompt injection pattern detected: '{pattern.pattern}'. Prompt safely rejected.",
                    blocked=True
                )
                self.security_logs.append(event)
                return False, event
        return True, None
