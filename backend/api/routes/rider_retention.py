from fastapi import APIRouter, HTTPException
from services.analytics_loader import AnalyticsLoader

router = APIRouter()
MODULE = "rider_retention"

def _load_csv(filename: str):
    try:
        return AnalyticsLoader.load_csv(MODULE, filename)
    except Exception:
        raise HTTPException(status_code=500, detail=f"Error loading {filename}")

def _load_json(filename: str):
    try:
        return AnalyticsLoader.load_json(MODULE, filename)
    except Exception:
        raise HTTPException(status_code=500, detail=f"Error loading {filename}")

@router.get("/profile")
def get_profile():
    return _load_csv("rider_profile.csv")

@router.get("/new-rider-cohort")
def get_new_rider_cohort():
    return _load_csv("new_rider_cohort.csv")

@router.get("/summary")
def get_summary():
    return _load_csv("retention_summary.csv")

@router.get("/first-experience")
def get_first_experience():
    return _load_csv("retention_first_experience.csv")

@router.get("/segments")
def get_segments():
    return _load_csv("retention_by_rider_segment.csv")

@router.get("/failure-relationship")
def get_failure_relationship():
    return _load_csv("failure_retention_relationship.csv")

@router.get("/pricing-relationship")
def get_pricing_relationship():
    return _load_csv("pricing_retention_relationship.csv")

@router.get("/support-relationship")
def get_support_relationship():
    return _load_csv("support_retention_relationship.csv")

@router.get("/journey")
def get_journey():
    return _load_csv("rider_journey_analysis.csv")

@router.get("/factors")
def get_factors():
    return _load_csv("retention_factor_analysis.csv")

@router.get("/cohort")
def get_cohort():
    return _load_csv("retention_cohort_analysis.csv")

@router.get("/flags")
def get_flags():
    return _load_csv("retention_flags.csv")

@router.get("/observations")
def get_observations():
    return _load_json("rider_retention_observations.json")

@router.get("/validation")
def get_validation():
    return _load_json("rider_retention_validation_report.json")
