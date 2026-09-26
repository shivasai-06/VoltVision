from fastapi import APIRouter, HTTPException
from services.analytics_loader import AnalyticsLoader

router = APIRouter()
MODULE = "battery_equipment"

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
    return _load_csv("battery_profile.csv")

@router.get("/soh")
def get_soh():
    return _load_csv("battery_soh_analysis.csv")

@router.get("/cycles")
def get_cycles():
    return _load_csv("battery_cycle_analysis.csv")

@router.get("/supplier")
def get_supplier():
    return _load_csv("battery_by_supplier.csv")

@router.get("/manufacturing-lot")
def get_manufacturing_lot():
    return _load_csv("battery_by_manufacturing_lot.csv")

@router.get("/swap-activity")
def get_swap_activity():
    return _load_csv("battery_swap_activity.csv")

@router.get("/equipment-relationship")
def get_equipment_relationship():
    return _load_csv("equipment_battery_relationship.csv")

@router.get("/cohort")
def get_cohort():
    return _load_csv("battery_cohort_analysis.csv")

@router.get("/flags")
def get_flags():
    return _load_csv("battery_equipment_flags.csv")

@router.get("/observations")
def get_observations():
    return _load_json("battery_equipment_observations.json")

@router.get("/validation")
def get_validation():
    return _load_json("battery_equipment_validation_report.json")
