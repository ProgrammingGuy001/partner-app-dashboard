from pydantic import BaseModel, field_serializer
from typing import Optional, List
from datetime import date
from decimal import Decimal

class JobStageCount(BaseModel):
    status: str
    count: int
    total_payout: Decimal
    total_additional_expense: Decimal
    
    @field_serializer('total_payout')
    def serialize_total_payout(self, value: Decimal) -> float:
        return float(value)
    
    @field_serializer('total_additional_expense')
    def serialize_total_additional_expense(self, value: Decimal) -> float:
        return float(value)
    
    class Config:
        from_attributes = True
    
class PayoutByIP(BaseModel):
    ip_id: int
    ip_name: str
    job_count: int
    total_payout: Decimal
    total_additional_expense: Decimal
    
    @field_serializer('total_payout')
    def serialize_total_payout(self, value: Decimal) -> float:
        return float(value)
    
    @field_serializer('total_additional_expense')
    def serialize_total_additional_expense(self, value: Decimal) -> float:
        return float(value)
    
    class Config:
        from_attributes = True
    
class PayoutSummary(BaseModel):
    period: str  # "week", "month", "quarter", "year"
    start_date: date
    end_date: date
    total_jobs: int
    total_payout: Decimal
    total_additional_expense: Decimal
    job_stages: List[JobStageCount]
    payout_by_ip: List[PayoutByIP]
    
    @field_serializer('total_payout')
    def serialize_total_payout(self, value: Decimal) -> float:
        return float(value)
    
    @field_serializer('total_additional_expense')
    def serialize_total_additional_expense(self, value: Decimal) -> float:
        return float(value)
    
    class Config:
        from_attributes = True