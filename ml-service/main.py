"""Minimal FastAPI service for vehicle price predictions."""

from __future__ import annotations

import json
import math
import re
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Annotated, Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator

# The serialized pipeline references VehicleFeatureEngineering from this module.
# It must be importable before joblib deserializes the pipeline.
import shared_vehicle_pipeline  # noqa: F401


SERVICE_DIR = Path(__file__).resolve().parent
MODEL_PATH = SERVICE_DIR / "models" / "vehicle_price_xgboost_pipeline.joblib"
SUPPORT_PATH = SERVICE_DIR / "data" / "supported_vehicles.json"
DATE_PATTERN = re.compile(r"^\d{2}/\d{2}/\d{4}$")
TRAINING_DATE_START = datetime(2024, 12, 3)
TRAINING_DATE_END = datetime(2025, 2, 5)
COLUMN_ALIASES = {
    "brand": "Brand",
    "model": "Model",
    "year_of_manufacture": "YOM",
    "engine_cc": "Engine (cc)",
    "gear": "Gear",
    "fuel_type": "Fuel Type",
    "mileage_km": "Mileage(KM)",
    "town": "Town",
    "listing_date": "Date",
    "leasing": "Leasing",
    "condition": "Condition",
    "air_condition": "AIR CONDITION",
    "power_steering": "POWER STEERING",
    "power_mirror": "POWER MIRROR",
    "power_window": "POWER WINDOW",
}


def pipeline_column_alias(field_name: str) -> str:
    return COLUMN_ALIASES.get(field_name, field_name)


class VehicleInput(BaseModel):
    model_config = ConfigDict(
        alias_generator=pipeline_column_alias,
        populate_by_name=True,
        extra="forbid",
        str_strip_whitespace=True,
    )

    brand: Annotated[str, Field(min_length=1)]
    model: Annotated[str, Field(min_length=1)]
    year_of_manufacture: Annotated[int, Field(ge=1886)]
    engine_cc: Annotated[float, Field(gt=0, allow_inf_nan=False)]
    gear: Annotated[str, Field(min_length=1)]
    fuel_type: Annotated[str, Field(min_length=1)]
    mileage_km: Annotated[float, Field(ge=0, allow_inf_nan=False)]
    town: Annotated[str, Field(min_length=1)]
    listing_date: str
    leasing: Annotated[str, Field(min_length=1)]
    condition: Annotated[str, Field(min_length=1)]
    air_condition: Annotated[str, Field(min_length=1)]
    power_steering: Annotated[str, Field(min_length=1)]
    power_mirror: Annotated[str, Field(min_length=1)]
    power_window: Annotated[str, Field(min_length=1)]

    @field_validator("listing_date")
    @classmethod
    def validate_listing_date(cls, value: str) -> str:
        if not DATE_PATTERN.fullmatch(value):
            raise ValueError("Date must use the MM/DD/YYYY format.")
        try:
            datetime.strptime(value, "%m/%d/%Y")
        except ValueError as error:
            raise ValueError("Date must be a valid date in MM/DD/YYYY format.") from error
        return value

    @field_validator("year_of_manufacture")
    @classmethod
    def validate_year_of_manufacture(cls, value: int) -> int:
        if value > datetime.now().year:
            raise ValueError("YOM cannot be in the future.")
        return value

    def pipeline_record(self) -> dict[str, Any]:
        return self.model_dump(by_alias=True)


class PredictionResponse(BaseModel):
    predicted_price_lakhs: float
    predicted_price_lkr: float
    brand: str
    model: str
    training_count: int
    support_category: str
    warning: str | None = None
    warnings: list[str] = Field(default_factory=list)


def fitted_categorical_values(pipeline: Any) -> dict[str, set[str]]:
    preprocessor = pipeline.named_steps["preprocessor"]
    allowed: dict[str, set[str]] = {}
    for transformer_name in ("cat", "high_card"):
        transformer = preprocessor.named_transformers_[transformer_name]
        encoder = transformer.named_steps["encoder"]
        columns = next(
            columns
            for name, _, columns in preprocessor.transformers_
            if name == transformer_name
        )
        for column, categories in zip(columns, encoder.categories_):
            if column != "Listing_Month":
                allowed[column] = {str(value) for value in categories}
    return allowed


@asynccontextmanager
async def lifespan(app: FastAPI):
    pipeline = joblib.load(MODEL_PATH)
    support_data = json.loads(SUPPORT_PATH.read_text(encoding="utf-8"))
    support_lookup = {
        (vehicle["brand"], vehicle["model"]): vehicle
        for vehicle in support_data["vehicles"]
    }

    app.state.pipeline = pipeline
    app.state.support_lookup = support_lookup
    app.state.allowed_categories = fitted_categorical_values(pipeline)
    yield


app = FastAPI(title="Vehicle Price Prediction Service", lifespan=lifespan)


@app.get("/health")
def health(request: Request) -> dict[str, Any]:
    return {
        "status": "ok",
        "model_loaded": hasattr(request.app.state, "pipeline"),
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(vehicle: VehicleInput, request: Request) -> PredictionResponse:
    record = vehicle.pipeline_record()
    support = request.app.state.support_lookup.get((vehicle.brand, vehicle.model))
    if support is None:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported Brand + Model combination: "
                f"{vehicle.brand} + {vehicle.model}."
            ),
        )

    listing_date = datetime.strptime(vehicle.listing_date, "%m/%d/%Y")
    listing_year = listing_date.year
    if vehicle.year_of_manufacture > listing_year:
        raise HTTPException(
            status_code=422,
            detail=(
                f"YOM {vehicle.year_of_manufacture} cannot be later than "
                f"the listing year {listing_year}."
            ),
        )

    # These are independent observed option sets for the Brand + Model. Their
    # presence does not imply every year and engine-capacity pairing occurred.
    if vehicle.year_of_manufacture not in support["manufacturing_years"]:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported YOM {vehicle.year_of_manufacture} for "
                f"{vehicle.brand} + {vehicle.model}. Select a manufacturing "
                "year listed for this Brand + Model."
            ),
        )

    if vehicle.engine_cc not in support["engine_cc_options"]:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported Engine (cc) {vehicle.engine_cc:g} for "
                f"{vehicle.brand} + {vehicle.model}. Select an engine "
                "capacity listed for this Brand + Model."
            ),
        )

    categorical_errors = []
    for column, allowed_values in request.app.state.allowed_categories.items():
        if column in {"Brand", "Model"}:
            continue
        value = str(record[column])
        if value not in allowed_values:
            categorical_errors.append(
                {
                    "field": column,
                    "value": value,
                    "message": "Value was not present in the model's training data.",
                }
            )
    if categorical_errors:
        raise HTTPException(status_code=422, detail=categorical_errors)

    prediction = float(
        request.app.state.pipeline.predict(pd.DataFrame([record]))[0]
    )
    if not math.isfinite(prediction):
        raise HTTPException(
            status_code=500,
            detail="The model returned a non-finite prediction.",
        )

    warnings = []
    if support["support_category"] == "very_limited":
        warnings.append(
            "Very limited training-data coverage for this Brand + Model; "
            "the prediction is not an accuracy guarantee."
        )
    if not TRAINING_DATE_START <= listing_date <= TRAINING_DATE_END:
        warnings.append(
            "The submitted listing date is outside the model's training period "
            "(12/03/2024–02/05/2025). This estimate is based on historical "
            "training data and may not reflect current market prices."
        )

    # Keep the original singular field usable by existing clients.
    warning = " ".join(warnings) or None

    return PredictionResponse(
        predicted_price_lakhs=prediction,
        predicted_price_lkr=prediction * 100_000,
        brand=vehicle.brand,
        model=vehicle.model,
        training_count=support["training_count"],
        support_category=support["support_category"],
        warning=warning,
        warnings=warnings,
    )
