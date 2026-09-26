# Common schemas and models
from pydantic import BaseModel
from typing import Optional, List, Any

class AnalyticsResponse(BaseModel):
    status: str = "success"
    data: Any
    
class ErrorResponse(BaseModel):
    error: str
