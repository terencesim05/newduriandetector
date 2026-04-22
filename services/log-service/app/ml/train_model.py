"""
Train all ML threat detection models.
Run once: python -m app.ml.train_model
"""

import os
import pickle

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")
DATA_PATH = os.path.join(MODELS_DIR, "training_data.csv")

SUPERVISED_MODELS = {
    "random_forest": {
        "cls": RandomForestClassifier(n_estimators=100, random_state=42),
        "file": "threat_model_random_forest.pkl",
    },
    "neural_network": {
        "cls": MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500, random_state=42),
        "file": "threat_model_neural_network.pkl",
    },
}

ISOLATION_FOREST_FILE = "threat_model_isolation_forest.pkl"

# Keep legacy filename pointing to random_forest
LEGACY_FILE = "threat_model.pkl"


def main():
    # --- Generate training data if it doesn't exist ---
    if not os.path.exists(DATA_PATH):
        print("Training data not found, generating...")
        from app.ml.generate_training_data import main as generate
        generate()

    # --- Load data ---
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} samples\n")

    features = ["severity", "category", "source_port", "destination_port", "protocol", "flagged_by_threatfox", "ids_source"]
    X = df[features]
    y = df["is_threat"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    os.makedirs(MODELS_DIR, exist_ok=True)

    # --- Supervised models (Random Forest, Neural Network) ---
    for name, spec in SUPERVISED_MODELS.items():
        print(f"{'=' * 50}")
        print(f"Training: {name}")
        print(f"{'=' * 50}")

        model = spec["cls"]
        model.fit(X_train, y_train)

        y_pred = model.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        print(f"Accuracy: {accuracy:.4f}")
        print(classification_report(y_test, y_pred, target_names=["Benign", "Malicious"]))

        path = os.path.join(MODELS_DIR, spec["file"])
        with open(path, "wb") as f:
            pickle.dump(model, f)
        print(f"Saved -> {path}\n")

        # Copy random_forest as legacy default
        if name == "random_forest":
            legacy_path = os.path.join(MODELS_DIR, LEGACY_FILE)
            with open(legacy_path, "wb") as f:
                pickle.dump(model, f)

    # --- Isolation Forest (unsupervised — trained on benign data only) ---
    print(f"{'=' * 50}")
    print("Training: isolation_forest")
    print(f"{'=' * 50}")

    X_benign = X_train[y_train == 0]
    iso_model = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
    iso_model.fit(X_benign)

    # Evaluate: IsolationForest returns -1 for anomaly, 1 for normal
    iso_pred = iso_model.predict(X_test)
    iso_pred_labels = np.where(iso_pred == -1, 1, 0)  # anomaly = threat
    accuracy = accuracy_score(y_test, iso_pred_labels)
    print(f"Accuracy: {accuracy:.4f}")
    print(classification_report(y_test, iso_pred_labels, target_names=["Benign", "Malicious"]))

    path = os.path.join(MODELS_DIR, ISOLATION_FOREST_FILE)
    with open(path, "wb") as f:
        pickle.dump(iso_model, f)
    print(f"Saved -> {path}\n")

    print("All models trained and saved.")


if __name__ == "__main__":
    main()
