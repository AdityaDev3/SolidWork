
import pandas as pd
import matplotlib.pyplot as plt
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.dummy import DummyClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

# --------------------------------------------------
# 1. LOAD DATA
# --------------------------------------------------
df = pd.read_csv("climateguard_synthetic_demo_training.csv")
df["date"] = pd.to_datetime(df["date"])
df = df.sort_values("date").reset_index(drop=True)

print("Dataset shape:", df.shape)
print("Data status:", df["data_status"].unique())

# This model is only a demonstration model.
if not df["data_status"].eq(
    "SYNTHETIC_NOT_OBSERVED"
).all():
    print("Warning: dataset has mixed or unexpected data status.")

# --------------------------------------------------
# 2. CREATE PAST-ONLY FEATURES
# --------------------------------------------------
df["cases_previous_week"] = df["cases"].shift(1)

df["cases_3week_average"] = (
    df["cases"].shift(1).rolling(3).mean()
)

df["rain_previous_week"] = df["rainfall_mm"].shift(1)
df["temperature_previous_week"] = (
    df["temperature_c"].shift(1)
)
df["humidity_previous_week"] = (
    df["humidity_pct"].shift(1)
)

features = [
    "cases_previous_week",
    "cases_3week_average",
    "rain_previous_week",
    "temperature_previous_week",
    "humidity_previous_week",
    "ndvi",
    "surface_water_index",
]

target = "target_next_week_elevated"

df = df.dropna(subset=features + [target]).copy()
df[target] = df[target].astype(int)

X = df[features]
y = df[target]

print("\nClass counts:")
print(y.value_counts().sort_index())

# --------------------------------------------------
# 3. CHRONOLOGICAL HOLDOUT
# --------------------------------------------------
split = int(len(df) * 0.80)

X_train, X_test = X.iloc[:split], X.iloc[split:]
y_train, y_test = y.iloc[:split], y.iloc[split:]

print("\nTraining period:",
      df["date"].iloc[0].date(), "to",
      df["date"].iloc[split - 1].date())

print("Test period:",
      df["date"].iloc[split].date(), "to",
      df["date"].iloc[-1].date())

print("Training rows:", len(X_train))
print("Test rows:", len(X_test))

if y_train.nunique() < 2 or y_test.nunique() < 2:
    raise ValueError(
        "Training or test period has only one class. "
        "Use more varied labelled data or a different "
        "time period for evaluation."
    )

# --------------------------------------------------
# 4. METRICS HELPER
# --------------------------------------------------
def show_metrics(name, actual, predicted):
    print(f"\n--- {name} ---")
    print("Accuracy:",
          round(accuracy_score(actual, predicted), 3))
    print("Balanced accuracy:",
          round(balanced_accuracy_score(
              actual, predicted
          ), 3))
    print("Elevated-risk precision:",
          round(precision_score(
              actual, predicted, zero_division=0
          ), 3))
    print("Elevated-risk recall:",
          round(recall_score(
              actual, predicted, zero_division=0
          ), 3))
    print("Elevated-risk F1:",
          round(f1_score(
              actual, predicted, zero_division=0
          ), 3))
    print("Confusion matrix [lower, elevated]:")
    print(confusion_matrix(
        actual, predicted, labels=[0, 1]
    ))
    print(classification_report(
        actual, predicted,
        labels=[0, 1],
        target_names=["Lower", "Elevated"],
        zero_division=0
    ))

# --------------------------------------------------
# 5. BASELINE: ALWAYS PREDICT MOST COMMON CLASS
# --------------------------------------------------
baseline = DummyClassifier(strategy="most_frequent")
baseline.fit(X_train, y_train)
baseline_predictions = baseline.predict(X_test)

show_metrics(
    "MAJORITY-CLASS BASELINE",
    y_test, baseline_predictions
)

# --------------------------------------------------
# 6. TRAIN RANDOM FOREST
# --------------------------------------------------
model = RandomForestClassifier(
    n_estimators=300,
    max_depth=8,
    min_samples_leaf=3,
    class_weight="balanced",
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)
predictions = model.predict(X_test)

show_metrics(
    "RANDOM FOREST - HELD-OUT TEST",
    y_test, predictions
)

# --------------------------------------------------
# 7. TIME-SERIES CROSS-VALIDATION
# --------------------------------------------------
# Use only the earlier training period here.
tscv = TimeSeriesSplit(n_splits=5)
fold_scores = []

for fold, (tr, val) in enumerate(
    tscv.split(X_train), start=1
):
    X_fold_train = X_train.iloc[tr]
    X_fold_val = X_train.iloc[val]
    y_fold_train = y_train.iloc[tr]
    y_fold_val = y_train.iloc[val]

    if y_fold_train.nunique() < 2:
        print(f"Skipping fold {fold}: one training class")
        continue

    fold_model = RandomForestClassifier(
        n_estimators=300,
        max_depth=8,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )
    fold_model.fit(X_fold_train, y_fold_train)
    fold_pred = fold_model.predict(X_fold_val)

    scores = {
        "fold": fold,
        "balanced_accuracy": balanced_accuracy_score(
            y_fold_val, fold_pred
        ),
        "precision": precision_score(
            y_fold_val, fold_pred, zero_division=0
        ),
        "recall": recall_score(
            y_fold_val, fold_pred, zero_division=0
        ),
        "f1": f1_score(
            y_fold_val, fold_pred, zero_division=0
        ),
    }
    fold_scores.append(scores)
    print(f"\nCross-validation fold {fold}: {scores}")

if fold_scores:
    cv_results = pd.DataFrame(fold_scores)
    print("\nMean cross-validation metrics:")
    print(cv_results.drop(columns="fold").mean().round(3))

    cv_results.to_csv(
        "climateguard_cv_results.csv", index=False
    )

# --------------------------------------------------
# 8. FEATURE IMPORTANCE
# --------------------------------------------------
importance = pd.Series(
    model.feature_importances_,
    index=features
).sort_values()

print("\nFeature importance:")
print(importance.sort_values(ascending=False).round(3))

importance.plot(kind="barh")
plt.title("ClimateGuard Feature Importance (Demo)")
plt.xlabel("Relative importance")
plt.tight_layout()
plt.savefig("feature_importance.png", dpi=150)
plt.show()

# --------------------------------------------------
# 9. SAVE MODEL AND FEATURE ORDER
# --------------------------------------------------
joblib.dump(
    {
        "model": model,
        "features": features,
        "target": target,
        "data_status": "SYNTHETIC_NOT_OBSERVED",
    },
    "climateguard_model.joblib"
)

print("\nSaved climateguard_model.joblib")
print("Saved feature_importance.png")
print("Saved climateguard_cv_results.csv if CV completed")
