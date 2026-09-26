import pandas as pd
import json
from pathlib import Path
from fastapi import HTTPException

# Using Path(__file__).resolve().parent.parent.parent to get the project root safely.
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ANALYTICS_DIR = BASE_DIR / "data" / "processed" / "analytics"

class AnalyticsLoader:
    @staticmethod
    def _get_file_path(module_name: str, file_name: str) -> Path:
        # Prevent path traversal
        if ".." in module_name or ".." in file_name:
            raise HTTPException(status_code=400, detail="Invalid path request")
            
        if module_name:
            path = ANALYTICS_DIR / module_name / file_name
        else:
            path = ANALYTICS_DIR / file_name
            
        return path

    @classmethod
    def load_csv(cls, module_name: str, file_name: str) -> list[dict]:
        path = cls._get_file_path(module_name, file_name)
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Analytics file '{file_name}' not found.")
            
        try:
            df = pd.read_csv(path)
            # Replace NaNs with None for JSON serialization
            df = df.where(pd.notnull(df), None)
            return df.to_dict(orient="records")
        except Exception as e:
            raise HTTPException(status_code=500, detail="Error parsing analytics data")

    @classmethod
    def load_json(cls, module_name: str, file_name: str) -> dict:
        path = cls._get_file_path(module_name, file_name)
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"Analytics file '{file_name}' not found.")
            
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail="Error parsing analytics JSON")
