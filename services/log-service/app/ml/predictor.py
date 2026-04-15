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

# IDS source encoding
_IDS_SOURCE_ENC = {"suricata": 1, "zeek": 2, "snort": 3, "kismet": 4}

# Protocol encoding
_PROTOCOL_ENC = {"TCP": 1, "UDP": 2, "ICMP": 3, "HTTP": 4, "802.11": 5}

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


def clear_cache():
    """Clear loaded model cache (call after retraining)."""
    _models.clear()
    logger.info("ML model cache cleared")


def predict_threat(severity: str, category: str, alert_count_last_hour: int = 1,
                   source_port: int = 0, destination_port: int = 0,
                   ids_source: str = "", protocol: str = "",
                   has_threat_intel: int = 0,
                   model_type: str = "random_forest") -> dict | None:
    """
    Predict whether an alert is a threat.
    Returns {"is_threat": bool, "confidence": float} or None if model unavailable.
    """
    model = _load_model(model_type)
    if model is None:
        return None

    base_features = [
        _SEVERITY_ENC.get(severity, 2),
        _CATEGORY_ENC.get(category, 1),
        alert_count_last_hour,
        source_port or 0,
        destination_port or 0,
    ]

    extra_features = [
        _IDS_SOURCE_ENC.get(ids_source, 0),
        _PROTOCOL_ENC.get(protocol.upper() if protocol else "", 0),
        int(has_threat_intel),
    ]

    # Check how many features the model expects (backward compat with old 5-feature models)
    try:
        expected = model.n_features_in_
    except AttributeError:
        expected = 5

    if expected >= 8:
        features = [base_features + extra_features]
    else:
        features = [base_features]

    if model_type == "isolation_forest":
        raw_score = model.score_samples(features)[0]
        threat_prob = max(0.0, min(1.0, 0.5 - raw_score))
    else:
        proba = model.predict_proba(features)[0]
        threat_prob = float(proba[1])  # probability of class 1 (malicious)

    return {
        "is_threat": threat_prob >= 0.5,
        "confidence": round(threat_prob, 3),
    }
