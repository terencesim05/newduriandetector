"""Basic threat scoring based on severity + category."""

from app.models.alert import Severity, Category

_SEVERITY_WEIGHT: dict[Severity, float] = {
    Severity.LOW: 0.1,
    Severity.MEDIUM: 0.3,
    Severity.HIGH: 0.6,
    Severity.CRITICAL: 0.9,
}

_CATEGORY_WEIGHT: dict[Category, float] = {
    Category.SQL_INJECTION: 0.85,
    Category.COMMAND_INJECTION: 0.85,
    Category.PRIVILEGE_ESCALATION: 0.80,
    Category.DATA_EXFILTRATION: 0.80,
    Category.MALWARE: 0.75,
    Category.XSS: 0.65,
    Category.BRUTE_FORCE: 0.60,
    Category.DDOS: 0.55,
    Category.PORT_SCAN: 0.35,
    Category.ANOMALY: 0.30,
    Category.OTHER: 0.20,
}


def calculate_threat_score(severity: Severity, category: Category) -> float:
    sev = _SEVERITY_WEIGHT.get(severity, 0.3)
    cat = _CATEGORY_WEIGHT.get(category, 0.2)
    score = 0.6 * sev + 0.4 * cat
    return round(min(max(score, 0.0), 1.0), 3)
