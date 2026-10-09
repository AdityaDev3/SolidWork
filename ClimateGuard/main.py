
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# --------------------------------------------------
# 1. APP CONFIGURATION
# --------------------------------------------------

app = FastAPI(
    title="ClimateGuard API",
    description="Climate-informed disease risk prediction",
    version="1.0.0",
)

# Permit browser frontends served locally during development, including
# common localhost ports.
origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:8001",
    "http://localhost:8001",
    "http://127.0.0.1:8002",
    "http://localhost:8002",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|null)$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

MODEL_PATH = Path(__file__).parent / "climateguard_model.joblib"

# --------------------------------------------------
# 2. LOAD TRAINED MODEL
# --------------------------------------------------

model_bundle = None
model = None
features = []
data_status = "UNKNOWN"
model_load_error = None

try:
    model_bundle = joblib.load(MODEL_PATH)

    if isinstance(model_bundle, dict):
        model = model_bundle["model"]
        features = model_bundle["features"]
        data_status = model_bundle.get(
            "data_status", "UNKNOWN"
        )
    else:
        # Supports a plain saved estimator as a fallback.
        model = model_bundle
        features = [
            "cases_previous_week",
            "cases_3week_average",
            "rain_previous_week",
            "temperature_previous_week",
            "humidity_previous_week",
            "ndvi",
            "surface_water_index",
        ]

except Exception as exc:
    model_load_error = str(exc)


# --------------------------------------------------
# 3. REQUEST FORMAT
# --------------------------------------------------

class PredictionInput(BaseModel):
    cases_previous_week: float = Field(ge=0)
    cases_3week_average: float = Field(ge=0)
    rain_previous_week: float = Field(ge=0)
    temperature_previous_week: float
    humidity_previous_week: float = Field(ge=0, le=100)
    ndvi: float = Field(ge=-1, le=1)
    surface_water_index: float = Field(ge=0, le=1)


# --------------------------------------------------
# 4. HEALTH CHECK
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Welcome to ClimateGuard API",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "ok" if model is not None else "model_not_loaded",
        "model_loaded": model is not None,
        "data_status": data_status,
        "error": model_load_error,
    }


# --------------------------------------------------
# 5. PREDICTION ENDPOINT
# --------------------------------------------------

@app.post("/predict")
def predict(data: PredictionInput):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Model is unavailable. Check /health and the model file.",
        )

    try:
        input_values = data.model_dump()
        input_df = pd.DataFrame([input_values])

        # Match the exact feature order used in training.
        missing_features = [
            name for name in features
            if name not in input_df.columns
        ]

        if missing_features:
            raise HTTPException(
                status_code=500,
                detail=f"Missing model features: {missing_features}",
            )

        input_df = input_df[features]

        prediction = int(model.predict(input_df)[0])

        elevated_probability = None
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(input_df)[0]
            classes = list(model.classes_)

            if 1 in classes:
                elevated_probability = float(
                    probabilities[classes.index(1)]
                )

        return {
            "prediction": prediction,
            "risk_level": (
                "Elevated" if prediction == 1 else "Lower"
            ),
            "elevated_probability": elevated_probability,
            "data_status": data_status,
            "warning": (
                "Experimental result from a model trained on "
                "synthetic data. Not a validated real-world forecast."
                if data_status == "SYNTHETIC_NOT_OBSERVED"
                else "Model output requires appropriate validation."
            ),
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(exc)}",
        )
