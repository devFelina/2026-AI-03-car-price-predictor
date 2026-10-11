"""Verify that the saved vehicle-price pipeline can be deserialized."""

from __future__ import annotations

import json
from pathlib import Path

import joblib

# The serialized pipeline references VehicleFeatureEngineering from this module.
# Import it before calling joblib.load so that the class is available to pickle.
import shared_vehicle_pipeline  # noqa: F401


SERVICE_DIR = Path(__file__).resolve().parent
MODEL_PATH = SERVICE_DIR / "models" / "vehicle_price_xgboost_pipeline.joblib"
METADATA_PATH = SERVICE_DIR / "models" / "model_metadata.json"


def expected_raw_feature_count(pipeline: object) -> int:
    """Return the fitted input count, falling back to the saved model metadata."""
    feature_names = getattr(pipeline, "feature_names_in_", None)
    if feature_names is not None:
        return len(feature_names)

    with METADATA_PATH.open(encoding="utf-8") as metadata_file:
        metadata = json.load(metadata_file)

    raw_input_columns = metadata.get("raw_input_columns")
    if not isinstance(raw_input_columns, list):
        raise ValueError(
            "Model metadata does not contain a 'raw_input_columns' list."
        )
    return len(raw_input_columns)


def main() -> None:
    pipeline = joblib.load(MODEL_PATH)

    named_steps = getattr(pipeline, "named_steps", None)
    if named_steps is None:
        raise TypeError("Loaded object is not a pipeline with named steps.")
    if "model" not in named_steps:
        raise KeyError("Loaded pipeline does not contain a 'model' step.")

    estimator = named_steps["model"]
    estimator_type = f"{type(estimator).__module__}.{type(estimator).__name__}"

    print(f"Pipeline steps: {list(named_steps.keys())}")
    print(f"Model type: {estimator_type}")
    print(f"Expected raw input features: {expected_raw_feature_count(pipeline)}")
    print(f"Model loaded successfully: {MODEL_PATH}")


if __name__ == "__main__":
    main()
