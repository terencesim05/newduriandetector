"""
Load real labelled IDS traffic from UNSW-NB15 and convert to the 7-feature
training schema used by the threat detection models.

Source: UNSW-NB15 (UNSW Canberra, Moustafa & Slay, 2015) — 175,341 labelled
flows across 9 attack categories plus Normal traffic. Downloaded once on
first run; cached locally in the models/ directory.

The four columns we read directly:
    proto       -> protocol (tcp/udp/icmp/other)
    service     -> destination_port (well-known service -> standard port)
    attack_cat  -> category + severity (mapped to DurianDetector taxonomy)
    label       -> is_threat (0 = benign, 1 = malicious)

Synthesised columns (not in UNSW-NB15):
    source_port             -> random ephemeral port (real source ports are random)
    flagged_by_threatfox    -> 0 (UNSW-NB15 captures predate ThreatFox)
    ids_source              -> random across {suricata, zeek, snort, kismet}
"""

import os
import urllib.request

import pandas as pd

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")
RAW_PATH = os.path.join(MODELS_DIR, "unsw_nb15_raw.csv")
OUTPUT_PATH = os.path.join(MODELS_DIR, "training_data.csv")

DATASET_URL = (
    "https://raw.githubusercontent.com/Nir-J/ML-Projects/master/"
    "UNSW-Network_Packet_Classification/UNSW_NB15_training-set.csv"
)

# UNSW-NB15 attack_cat -> DurianDetector category encoding (1..10).
# Normal rows get OTHER=1; their label is what matters.
ATTACK_TO_CATEGORY = {
    "Normal":         1,   # OTHER
    "Generic":        7,   # MALWARE
    "Exploits":       8,   # PRIVILEGE_ESCALATION
    "Fuzzers":        2,   # ANOMALY
    "DoS":            4,   # DDOS
    "Reconnaissance": 3,   # PORT_SCAN
    "Analysis":       2,   # ANOMALY
    "Backdoor":       7,   # MALWARE
    "Shellcode":      10,  # COMMAND_INJECTION
    "Worms":          7,   # MALWARE
}

# UNSW-NB15 attack_cat -> severity encoding (1..4).
ATTACK_TO_SEVERITY = {
    "Normal":         1,   # LOW
    "Fuzzers":        2,   # MEDIUM
    "Analysis":       2,
    "Reconnaissance": 2,
    "Generic":        3,   # HIGH
    "Backdoor":       3,
    "DoS":            4,   # CRITICAL
    "Exploits":       4,
    "Shellcode":      4,
    "Worms":          4,
}

# UNSW-NB15 service column -> standard destination port.
SERVICE_TO_PORT = {
    "-":        0,
    "dhcp":     67,
    "dns":      53,
    "ftp":      21,
    "ftp-data": 20,
    "http":     80,
    "irc":      6667,
    "pop3":     110,
    "radius":   1812,
    "smtp":     25,
    "snmp":     161,
    "ssh":      22,
    "ssl":      443,
}

PROTOCOL_ENC = {"tcp": 1, "udp": 2, "icmp": 3}


def _download_if_missing():
    if os.path.exists(RAW_PATH):
        return
    os.makedirs(MODELS_DIR, exist_ok=True)
    print(f"Downloading UNSW-NB15 from {DATASET_URL} ...")
    urllib.request.urlretrieve(DATASET_URL, RAW_PATH)
    size_mb = os.path.getsize(RAW_PATH) / (1024 * 1024)
    print(f"Saved -> {RAW_PATH} ({size_mb:.1f} MB)")


def main():
    _download_if_missing()

    df = pd.read_csv(RAW_PATH)
    print(f"Loaded {len(df):,} rows from UNSW-NB15")

    # Balance classes to match the original synthetic 50/50 ratio.
    benign = df[df["label"] == 0]
    malicious = df[df["label"] == 1]
    n = min(len(benign), len(malicious))
    benign = benign.sample(n=n, random_state=42)
    malicious = malicious.sample(n=n, random_state=42)
    df = pd.concat([benign, malicious], ignore_index=True)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    print(f"Balanced to {len(df):,} rows ({n:,} benign / {n:,} malicious)")

    # Map columns to the 7-feature schema.
    out = pd.DataFrame()
    out["severity"] = df["attack_cat"].map(ATTACK_TO_SEVERITY).fillna(1).astype(int)
    out["category"] = df["attack_cat"].map(ATTACK_TO_CATEGORY).fillna(1).astype(int)
    # Random ephemeral source ports, deterministic per row via numpy.
    rng = pd.Series(range(len(df))).apply(lambda i: 1024 + (hash((i, 7919)) % 64511))
    out["source_port"] = rng.astype(int)
    out["destination_port"] = df["service"].map(SERVICE_TO_PORT).fillna(0).astype(int)
    out["protocol"] = df["proto"].str.lower().map(PROTOCOL_ENC).fillna(0).astype(int)
    out["flagged_by_threatfox"] = 0
    # Distribute IDS source uniformly across {1,2,3,4}.
    out["ids_source"] = (df.index % 4 + 1).astype(int)
    out["is_threat"] = df["label"].astype(int)

    os.makedirs(MODELS_DIR, exist_ok=True)
    out.to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {len(out):,} samples -> {OUTPUT_PATH}")
    print()
    print("Class balance:")
    print(out["is_threat"].value_counts().to_dict())
    print()
    print("Category distribution:")
    print(out["category"].value_counts().sort_index().to_dict())


if __name__ == "__main__":
    main()
