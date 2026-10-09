
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import urllib.request
import urllib.error
import urllib.parse
import json
import time
import csv
import math

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
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
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

# --------------------------------------------------
# 6. EXTERNAL DATA INTEGRATIONS
# --------------------------------------------------

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_ATTRIBUTION = "Open-Meteo"
OPEN_METEO_URL_ATTRIBUTION = "https://open-meteo.com/"
PUNE_LATITUDE = 18.5204
PUNE_LONGITUDE = 73.8567
WEATHER_CACHE_TTL = 900
HISTORY_CACHE_TTL = 21600
weather_cache = {"data": None, "timestamp": 0}
history_cache = {"data": None, "timestamp": 0}


def _fetch_json(url: str, provider: str):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "ClimateGuard/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"{provider} data request failed: {exc}",
        ) from exc
    if not isinstance(result, dict):
        raise HTTPException(
            status_code=502,
            detail=f"{provider} returned an invalid response.",
        )
    return result


def _number_or_none(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


def _retrieved_at():
    return datetime.now(timezone.utc).isoformat()

@app.get("/api/weather/pune")
def get_pune_weather():
    if weather_cache["data"] and (
        time.time() - weather_cache["timestamp"] < WEATHER_CACHE_TTL
    ):
        return weather_cache["data"]

    query = urllib.parse.urlencode({
        "latitude": PUNE_LATITUDE,
        "longitude": PUNE_LONGITUDE,
        "current": "temperature_2m,relative_humidity_2m,precipitation",
        "timezone": "Asia/Kolkata",
    })
    data = _fetch_json(f"{OPEN_METEO_URL}?{query}", OPEN_METEO_ATTRIBUTION)
    current = data.get("current")
    if not isinstance(current, dict) or not current.get("time"):
        raise HTTPException(
            status_code=502,
            detail="Open-Meteo did not return current weather values for Pune.",
        )

    result = {
        "status": "success",
        "location": "Pune, Maharashtra",
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "temperature_c": _number_or_none(current.get("temperature_2m")),
        "relative_humidity_pct": _number_or_none(
            current.get("relative_humidity_2m")
        ),
        "precipitation_mm": _number_or_none(current.get("precipitation")),
        "valid_at": current["time"],
        "interval_minutes": current.get("interval"),
        "data_kind": "weather_model_estimate",
        "source": OPEN_METEO_ATTRIBUTION,
        "source_url": OPEN_METEO_URL_ATTRIBUTION,
        "retrieved_at": _retrieved_at(),
        "limitation": (
            "Model-derived current conditions, not a Pune station observation. "
            "Precipitation is the provider's current-interval estimate."
        ),
    }
    weather_cache["data"] = result
    weather_cache["timestamp"] = time.time()
    return result


@app.get("/api/weather/pune/history")
def get_pune_weather_history():
    if history_cache["data"] and (
        time.time() - history_cache["timestamp"] < HISTORY_CACHE_TTL
    ):
        return history_cache["data"]

    end_date = datetime.now(ZoneInfo("Asia/Kolkata")).date() - timedelta(days=1)
    start_date = end_date - timedelta(days=29)
    query = urllib.parse.urlencode({
        "latitude": PUNE_LATITUDE,
        "longitude": PUNE_LONGITUDE,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": "temperature_2m_mean,precipitation_sum",
        "hourly": "relative_humidity_2m",
        "timezone": "Asia/Kolkata",
    })
    data = _fetch_json(
        f"{OPEN_METEO_ARCHIVE_URL}?{query}",
        f"{OPEN_METEO_ATTRIBUTION} Historical Weather API",
    )
    daily = data.get("daily")
    hourly = data.get("hourly")
    if not isinstance(daily, dict) or not isinstance(hourly, dict):
        raise HTTPException(
            status_code=502,
            detail="Open-Meteo did not return the requested historical climate series.",
        )

    dates = daily.get("time")
    temperatures = daily.get("temperature_2m_mean")
    precipitation = daily.get("precipitation_sum")
    humidity_dates = hourly.get("time")
    humidity_values = hourly.get("relative_humidity_2m")
    if not all(
        isinstance(values, list)
        for values in (
            dates, temperatures, precipitation, humidity_dates, humidity_values
        )
    ) or not (len(dates) == len(temperatures) == len(precipitation)):
        raise HTTPException(
            status_code=502,
            detail="Open-Meteo returned mismatched historical climate series.",
        )

    humidity_by_date = {}
    for timestamp, value in zip(humidity_dates, humidity_values):
        humidity = _number_or_none(value)
        if isinstance(timestamp, str) and humidity is not None:
            humidity_by_date.setdefault(timestamp[:10], []).append(humidity)

    records = []
    for day, temperature, rain in zip(dates, temperatures, precipitation):
        humidity_values_for_day = humidity_by_date.get(day, [])
        records.append({
            "date": day,
            "location": "Pune, Maharashtra",
            "mean_temperature_c": _number_or_none(temperature),
            "precipitation_sum_mm": _number_or_none(rain),
            "mean_relative_humidity_pct": (
                sum(humidity_values_for_day) / len(humidity_values_for_day)
                if humidity_values_for_day else None
            ),
        })

    result = {
        "status": "success",
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "location": "Pune, Maharashtra",
        "records": records,
        "data_kind": "historical_weather_reanalysis",
        "humidity_method": (
            "Daily arithmetic mean of available hourly relative-humidity values."
        ),
        "source": "Open-Meteo Historical Weather API",
        "source_url": "https://open-meteo.com/en/docs/historical-weather-api",
        "retrieved_at": _retrieved_at(),
        "limitation": (
            "Historical model reanalysis, not station observations. "
            "Recent days may be revised or unavailable."
        ),
    }
    history_cache["data"] = result
    history_cache["timestamp"] = time.time()
    return result


@app.get("/api/dengue/pune")
def get_pune_dengue_data():
    csv_path = Path(__file__).parent / "data" / "pune_dengue_cases.csv"
    if not csv_path.exists():
        return {
            "status": "unavailable",
            "message": (
                "No verified Pune dengue surveillance CSV is installed. "
                "Import only official records using the documented schema in "
                "ClimateGuard/data/README.md."
            ),
            "required_columns": [
                "period_start", "period_end", "area", "area_level", "cases",
                "source", "source_url", "published_at", "status",
            ],
            "source": "No dataset configured",
            "retrieved_at": _retrieved_at(),
        }

    cases_data = []
    required_columns = {
        "period_start", "period_end", "area", "area_level", "cases",
        "source", "source_url", "published_at", "status",
    }
    try:
        with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames or not required_columns.issubset(reader.fieldnames):
                raise ValueError(
                    "CSV is missing required columns: "
                    + ", ".join(sorted(required_columns))
                )
            for row in reader:
                if not row.get("area", "").strip():
                    raise ValueError("Each CSV row must include its geographic area.")
                try:
                    period_start = date.fromisoformat(row["period_start"])
                    period_end = date.fromisoformat(row["period_end"])
                    published_at = date.fromisoformat(row["published_at"])
                    case_count = int(row["cases"])
                except (TypeError, ValueError) as exc:
                    raise ValueError(
                        "Dates must use YYYY-MM-DD and cases must be a whole number."
                    ) from exc
                if period_end < period_start or case_count < 0:
                    raise ValueError(
                        "Reporting period must be ordered and cases cannot be negative."
                    )
                if row.get("status", "").strip().lower() not in {
                    "reported", "provisional", "incomplete", "aggregated"
                }:
                    raise ValueError(
                        "status must be reported, provisional, incomplete, or aggregated."
                    )
                if not all(row.get(field, "").strip() for field in (
                    "area_level", "source", "source_url", "published_at"
                )):
                    raise ValueError(
                        "Each row must include area_level, source, source_url, "
                        "and published_at."
                    )
                source_url = urllib.parse.urlparse(row["source_url"].strip())
                if (
                    source_url.scheme != "https"
                    or not source_url.hostname
                    or not (
                        source_url.hostname == "gov.in"
                        or source_url.hostname.endswith(".gov.in")
                    )
                ):
                    raise ValueError(
                        "source_url must be an HTTPS link on an official .gov.in domain."
                    )
                area = row["area"].strip().casefold()
                area_level = row["area_level"].strip().casefold()
                if not (
                    (area == "pune district" and area_level == "district")
                    or (
                        area == "pune municipal corporation"
                        and area_level in {"municipal corporation", "city"}
                    )
                ):
                    continue
                cases_data.append({
                    "period_start": period_start.isoformat(),
                    "period_end": period_end.isoformat(),
                    "area": row["area"].strip(),
                    "area_level": row["area_level"].strip(),
                    "cases": case_count,
                    "source": row["source"].strip(),
                    "source_url": source_url.geturl(),
                    "published_at": published_at.isoformat(),
                    "status": row["status"].strip().lower(),
                })
    except (OSError, csv.Error, ValueError) as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid Pune dengue CSV: {exc}",
        ) from exc

    cases_data.sort(key=lambda item: (item["period_start"], item["area_level"]))
    if not cases_data:
        return {
            "status": "unavailable",
            "message": (
                "The imported file contains no Pune-level records. "
                "Maharashtra-wide records are not presented as Pune data."
            ),
            "source": "Local official CSV import",
            "retrieved_at": _retrieved_at(),
        }
    return {
        "status": "success",
        "geographic_filter": "Pune district or Pune Municipal Corporation only",
        "records": cases_data,
        "source": "Verified official CSV import",
        "retrieved_at": _retrieved_at(),
    }


@app.get("/api/environment/pune")
def get_pune_environment_data():
    return {
        "status": "unavailable",
        "location": "Pune, Maharashtra",
        "indicators": {
            "ndvi": None,
            "surface_water": None,
        },
        "message": (
            "No verified Pune raster values are configured. NDVI requires "
            "NASA Earthdata access, quality screening, and spatial extraction; "
            "no satellite values are inferred or substituted."
        ),
        "candidate_ndvi_dataset": {
            "name": "MODIS/Terra MOD13Q1.061",
            "resolution_m": 250,
            "composite_days": 16,
            "ndvi_scale_factor": 0.0001,
            "source": (
                "https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod13q1-061"
            ),
        },
        "candidate_surface_water_method": {
            "index": "Normalized Difference Water Index (NDWI)",
            "formula": "(green_surface_reflectance - NIR_surface_reflectance) / "
            "(green_surface_reflectance + NIR_surface_reflectance)",
            "dataset": "MODIS/Terra MOD09A1.061",
            "resolution_m": 500,
            "composite_days": 8,
            "surface_reflectance_scale_factor": 0.0001,
            "source": (
                "https://www.earthdata.nasa.gov/data/catalog/lpcloud-mod09a1-061"
            ),
            "limitation": (
                "NDWI is a derived spectral index, not a measured water-area "
                "or water-occurrence estimate."
            ),
        },
        "source": "NASA LP DAAC",
        "retrieved_at": _retrieved_at(),
    }
