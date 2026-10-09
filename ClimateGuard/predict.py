
import joblib
import pandas as pd

# Load the trained model
saved = joblib.load("climateguard_model.joblib")
model = saved["model"]
features = saved["features"]

# Example inputs only — not real Pune observations
latest_data = {
    "cases_previous_week": 12,
    "cases_3week_average": 10.3,
    "rain_previous_week": 42.0,
    "temperature_previous_week": 28.5,
    "humidity_previous_week": 76.0,
    "ndvi": 0.55,
    "surface_water_index": 0.40
}

# Arrange columns in the same order used during training
X_new = pd.DataFrame([latest_data])[features]

prediction = model.predict(X_new)[0]
probabilities = model.predict_proba(X_new)[0]
class_index = list(model.classes_).index(1)

print("Prediction:",
      "Elevated risk" if prediction == 1 else "Lower risk")

print("Model-estimated elevated probability:",
      round(probabilities[class_index] * 100, 1), "%")
