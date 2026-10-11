
import pandas as pd

from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer


NUMERIC_FEATURES = [
    "Engine (cc)",
    "Vehicle_Age",
    "Feature_Count"
]

CATEGORICAL_FEATURES = [
    "Brand",
    "Gear",
    "Fuel Type",
    "Leasing",
    "Condition",
    "AIR CONDITION",
    "POWER STEERING",
    "POWER MIRROR",
    "POWER WINDOW",
    "Listing_Month"
]

HIGH_CARDINALITY_FEATURES = [
    "Model",
    "Town"
]


class VehicleFeatureEngineering(BaseEstimator, TransformerMixin):

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        X = X.copy()

        X["Date"] = pd.to_datetime(
            X["Date"],
            errors="coerce"
        )

        X["Vehicle_Age"] = (
            X["Date"].dt.year - X["YOM"]
        )

        X["Listing_Month"] = X["Date"].dt.month

        feature_cols = [
            "AIR CONDITION",
            "POWER STEERING",
            "POWER MIRROR",
            "POWER WINDOW"
        ]

        X["Feature_Count"] = (
            X[feature_cols] == "Available"
        ).sum(axis=1)

        X = X.drop(
            columns=[
                "YOM",
                "Mileage(KM)",
                "Millage(KM)",
                "Date"
            ],
            errors="ignore"
        )

        return X


def create_preprocessor():

    numeric_pipeline = Pipeline([
        (
            "imputer",
            SimpleImputer(strategy="median")
        )
    ])

    categorical_pipeline = Pipeline([
        (
            "imputer",
            SimpleImputer(strategy="most_frequent")
        ),
        (
            "encoder",
            OneHotEncoder(
                handle_unknown="ignore",
                sparse_output=False
            )
        )
    ])

    high_cardinality_pipeline = Pipeline([
        (
            "imputer",
            SimpleImputer(strategy="most_frequent")
        ),
        (
            "encoder",
            OneHotEncoder(
                handle_unknown="infrequent_if_exist",
                min_frequency=10,
                sparse_output=False
            )
        )
    ])

    return ColumnTransformer([
        ("num", numeric_pipeline, NUMERIC_FEATURES),
        ("cat", categorical_pipeline, CATEGORICAL_FEATURES),
        (
            "high_card",
            high_cardinality_pipeline,
            HIGH_CARDINALITY_FEATURES
        )
    ])


def create_vehicle_pipeline(model):

    return Pipeline([
        ("feature_engineering", VehicleFeatureEngineering()),
        ("preprocessor", create_preprocessor()),
        ("model", model)
    ])
