"""Registry of pre-loaded sample comparison scenarios."""

from pathlib import Path
import json

FIXTURES_DIR = Path(__file__).parent / "fixtures"

SAMPLES = {
    "portscan": {
        "name": "portscan",
        "label": "Nmap Port Scan",
        "description": (
            "An aggressive Nmap port sweep against a single host across 14 common service ports. "
            "Both engines flag scan activity, but they disagree on which ports look most suspicious "
            "and whether NSE-based detection should escalate severity."
        ),
        "pcap_filename": "portscan.pcap",
    },
    "sqli": {
        "name": "sqli",
        "label": "SQL Injection (HTTP)",
        "description": (
            "A series of HTTP requests against a vulnerable endpoint containing UNION SELECT, "
            "comment-based, and 1=1 injection payloads. Both engines catch the attack — but they "
            "rate the severity very differently, which is the most interesting part of the comparison."
        ),
        "pcap_filename": "sqli.pcap",
    },
    "ssh-bruteforce": {
        "name": "ssh-bruteforce",
        "label": "SSH Brute Force",
        "description": (
            "Repeated SSH login attempts from a single source against an exposed sshd. "
            "Snort fires its scan signature on every connection. Suricata catches additional "
            "events Snort misses entirely — including a stateful brute-force rule and a "
            "libssh exploit signature — illustrating engine-specific blind spots."
        ),
        "pcap_filename": "ssh-bruteforce.pcap",
    },
}


def list_samples():
    return [
        {"name": s["name"], "label": s["label"], "description": s["description"]}
        for s in SAMPLES.values()
    ]


def get_sample(name: str):
    return SAMPLES.get(name)


def load_engine_output(sample_name: str, engine: str) -> list[dict]:
    """Load the pre-computed alerts for a sample/engine pair from disk."""
    path = FIXTURES_DIR / f"{sample_name}.{engine}.json"
    if not path.exists():
        raise FileNotFoundError(f"No fixture for {sample_name}/{engine}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)
