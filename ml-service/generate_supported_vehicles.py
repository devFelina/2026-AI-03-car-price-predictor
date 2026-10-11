"""Generate vehicle coverage labels from the model's training split."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split


SERVICE_DIR = Path(__file__).resolve().parent
DATASET_PATH = SERVICE_DIR / "data" / "car_price_dataset.csv"
OUTPUT_PATH = SERVICE_DIR / "data" / "supported_vehicles.json"

EXPECTED_CLEANED_ROWS = 9_743
EXPECTED_TRAINING_ROWS = 7_794


def support_category(training_count: int) -> str:
    if training_count >= 30:
        return "well_represented"
    if training_count >= 10:
        return "limited"
    return "very_limited"


def valid_numeric_options(
    values: pd.Series,
    *,
    whole_numbers_only: bool = False,
) -> list[int | float]:
    numeric = pd.to_numeric(values, errors="coerce")
    numeric = numeric[
        numeric.notna()
        & (numeric > 0)
        & (numeric != float("inf"))
    ]
    if whole_numbers_only:
        numeric = numeric[numeric.mod(1).eq(0)]

    return [
        int(value) if float(value).is_integer() else float(value)
        for value in sorted(numeric.unique())
    ]


def main() -> None:
    data = pd.read_csv(DATASET_PATH)
    cleaned = (
        data.drop(columns=["Unnamed: 0"])
        .dropna(subset=["Price"])
        .drop_duplicates()
        .reset_index(drop=True)
    )

    assert len(cleaned) == EXPECTED_CLEANED_ROWS, (
        f"Expected {EXPECTED_CLEANED_ROWS:,} cleaned rows, "
        f"found {len(cleaned):,}."
    )

    X = cleaned.drop(columns=["Price"])
    y = cleaned["Price"]
    X_train, _, _, _ = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    assert len(X_train) == EXPECTED_TRAINING_ROWS, (
        f"Expected {EXPECTED_TRAINING_ROWS:,} training rows, "
        f"found {len(X_train):,}."
    )

    vehicles = []
    for (brand, model), records in X_train.groupby(
        ["Brand", "Model"],
        sort=True,
    ):
        training_count = len(records)
        vehicles.append(
            {
                "brand": brand,
                "model": model,
                "training_count": training_count,
                "support_category": support_category(training_count),
                "manufacturing_years": valid_numeric_options(
                    records["YOM"],
                    whole_numbers_only=True,
                ),
                "engine_cc_options": valid_numeric_options(
                    records["Engine (cc)"]
                ),
            }
        )

    output = {
        "coverage_note": (
            "Support categories describe training-data coverage and are not "
            "accuracy guarantees."
        ),
        "training_record_count": len(X_train),
        "vehicles": vehicles,
    }
    OUTPUT_PATH.write_text(
        json.dumps(output, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    category_counts = pd.Series(
        [vehicle["support_category"] for vehicle in vehicles]
    ).value_counts()
    print(f"Total brands: {X_train['Brand'].nunique()}")
    print(f"Brand + Model combinations: {len(vehicles)}")
    for category in ("well_represented", "limited", "very_limited"):
        print(f"{category}: {int(category_counts.get(category, 0))}")


if __name__ == "__main__":
    main()
