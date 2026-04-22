"""
ML threat prediction module.
Loads trained models by name and exposes predict_threat().
"""

import os
import pickle
import logging

logger = logging.getLogger(__name__)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")

MODEL_FILES = {
    "random_forest": "threat_model_random_forest.pkl",
    "isolation_forest": "threat_model_isolation_forest.pkl",
    "neural_network": "threat_model_neural_network.pkl",
}

LEGACY_FILE = "threat_model.pkl"

# Severity encoding (must match training data)
_SEVERITY_ENC = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

# Category encoding (must match training data)
_CATEGORY_ENC = {
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

# Protocol encoding: TCP=1, UDP=2, ICMP=3, OTHER/None=0
_PROTOCOL_ENC = {"TCP": 1, "UDP": 2, "ICMP": 3}

# IDS source encoding
_IDS_SOURCE_ENC = {"suricata": 1, "zeek": 2, "snort": 3, "kismet": 4}

# Cache: model_type -> loaded model
_models: dict = {}


def _load_model(model_type: str = "random_forest"):
    if model_type in _models:
        return _models[model_type]

    filename = MODEL_FILES.get(model_type)
    if filename:
        path = os.path.join(MODELS_DIR, filename)
    else:
        path = os.path.join(MODELS_DIR, LEGACY_FILE)

    if not os.path.exists(path):
        # Fall back to legacy file
        path = os.path.join(MODELS_DIR, LEGACY_FILE)
        if not os.path.exists(path):
            logger.warning("ML model not found for %s — predictions disabled", model_type)
            return None

    with open(path, "rb") as f:
        model = pickle.load(f)
    _models[model_type] = model
    logger.info("ML model loaded: %s from %s", model_type, path)
    return model


def predict_threat(severity: str, category: str,
                   source_port: int = 0, destination_port: int = 0,
                   protocol: str | None = None,
                   flagged_by_threatfox: str = "false",
                   ids_source: str | None = None,
                   model_type: str = "random_forest") -> dict | None:
    """
    Predict whether an alert is a threat.
    Returns {"is_threat": bool, "confidence": float} or None if model unavailable.
    """
    model = _load_model(model_type)
    if model is None:
        return None

    proto_key = (protocol or "").upper()
    ids_key = (ids_source or "").lower()

    features = [[
        _SEVERITY_ENC.get(severity, 2),
        _CATEGORY_ENC.get(category, 1),
        source_port or 0,
        destination_port or 0,
        _PROTOCOL_ENC.get(proto_key, 0),
        1 if str(flagged_by_threatfox).lower() == "true" else 0,
        _IDS_SOURCE_ENC.get(ids_key, 0),
    ]]

    if model_type == "isolation_forest":
        # IsolationForest: score_samples returns negative anomaly scores
        # More negative = more anomalous. Convert to 0.0-1.0 confidence.
        raw_score = model.score_samples(features)[0]
        # Typical range is roughly -0.5 (anomaly) to 0.5 (normal)
        # Clamp and invert so higher = more threatening
        threat_prob = max(0.0, min(1.0, 0.5 - raw_score))
    else:
        proba = model.predict_proba(features)[0]
        threat_prob = float(proba[1])  # probability of class 1 (malicious)

    return {
        "is_threat": threat_prob >= 0.5,
        "confidence": round(threat_prob, 3),
    }
