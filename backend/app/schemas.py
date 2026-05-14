from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime

# --- Auth ---
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- Log Files ---
class LogFileOut(BaseModel):
    id: int
    original_filename: str
    file_size: Optional[int]
    log_type: str
    status: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

# --- Analysis ---
class AnomalyItem(BaseModel):
    line_number: Optional[int]
    raw_entry: str
    reason: str
    confidence: float          # 0.0 – 1.0
    category: str              # e.g. "high_request_volume", "suspicious_url", etc.

class TimelineEvent(BaseModel):
    timestamp: str
    event: str
    source_ip: Optional[str]
    destination: Optional[str]
    action: Optional[str]
    severity: str              # info | warning | critical

class AnalysisOut(BaseModel):
    id: int
    log_file_id: int
    summary: str
    timeline: List[TimelineEvent]
    anomalies: List[AnomalyItem]
    total_entries: int
    anomaly_count: int
    created_at: datetime

    class Config:
        from_attributes = True