from pydantic import BaseModel
from typing import Optional, List, Any

class KPISummary(BaseModel):
    total_attempts: int
    completed_swaps: int
    completion_rate: float
    total_revenue_inr: float
    failure_rate: float
    abandonment_rate: float
    cancellation_rate: float
    system_error_rate: float
    contribution_margin_per_swap: Optional[float]
    data_start_date: str
    data_end_date: str
    
class MonthlyTrend(BaseModel):
    month: str
    total_attempts: int
    completed_swaps: int
    completion_rate: float
    failure_rate: float
    abandonment_rate: float
    total_revenue: float
    contribution_margin_per_completed_swap: Optional[float]
