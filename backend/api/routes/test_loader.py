from fastapi import APIRouter
from services.analytics_loader import AnalyticsLoader

router = APIRouter()

@router.get("/api/test-loader")
def test_loader():
    try:
        # Load the validation report from battery_equipment (Step 4D)
        data = AnalyticsLoader.load_json("battery_equipment", "battery_equipment_validation_report.json")
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}
