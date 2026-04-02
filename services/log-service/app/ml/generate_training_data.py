"""
Generate synthetic training data for the threat detection model.
Produces 1000 alerts: 500 benign + 500 malicious.
"""

import csv
import os
import random

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "training_data.csv")

# Severity encoding: LOW=1, MEDIUM=2, HIGH=3, CRITICAL=4
SEVERITY_MAP = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

# Category encoding
CATEGORY_MAP = {
    "OTHER": 1,
    "ANOMALY": 2,
    "PORT_SCAN": 3,
    "DDOS": 4,
    "BRUTE_FORCE": 5,
    "XSS": 6,
    "MALWARE": 7,
    "PRIVILEGE_ESCALATION": 8,
    "DATA_EXFILTRATION": 9,
    "SQL_INJECTION": 10,
    "COMMAND_INJECTION": 10,
}

BENIGN_SEVERITIES = ["LOW", "MEDIUM"]
BENIGN_CATEGORIES = ["OTHER", "ANOMALY", "PORT_SCAN"]

MALICIOUS_SEVERITIES = ["HIGH", "CRITICAL"]
MALICIOUS_CATEGORIES = [
    "SQL_INJECTION", "COMMAND_INJECTION", "MALWARE",
    "BRUTE_FORCE", "PRIVILEGE_ESCALATION", "DATA_EXFILTRATION", "XSS",
]


def generate_benign():
    severity = random.choice(BENIGN_SEVERITIES)
    category = random.choice(BENIGN_CATEGORIES)
    return {
        "severity": SEVERITY_MAP[severity],
        "category": CATEGORY_MAP[category],
        "alert_count_last_hour": random.randint(1, 5),
        "source_port": random.randint(1024, 65535),
        "destination_port": random.choice([80, 443, 8080, 8443, 22]),
        "is_threat": 0,
    }


def generate_malicious():
    severity = random.choice(MALICIOUS_SEVERITIES)
    category = random.choice(MALICIOUS_CATEGORIES)
    return {
        "severity": SEVERITY_MAP[severity],
        "category": CATEGORY_MAP[category],
        "alert_count_last_hour": random.randint(10, 100),
        "source_port": random.randint(1024, 65535),
        "destination_port": random.choice([80, 443, 22, 3389, 445, 1433, 3306]),
        "is_threat": 1,
    }


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    random.seed(42)

    rows = []
    for _ in range(500):
        rows.append(generate_benign())
    for _ in range(500):
        rows.append(generate_malicious())
    random.shuffle(rows)

    fieldnames = ["severity", "category", "alert_count_last_hour", "source_port", "destination_port", "is_threat"]
    with open(OUTPUT_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} training samples -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
