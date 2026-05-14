import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, LogFile, Analysis
from app.schemas import AnalysisOut, TimelineEvent, AnomalyItem
from app.routes.auth import get_current_user

router = APIRouter()

@router.get("/{log_id}", response_model=AnalysisOut)
def get_analysis(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.query(LogFile).filter(LogFile.id == log_id, LogFile.owner_id == current_user.id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log file not found")
    if log.status == "processing":
        raise HTTPException(status_code=202, detail="Analysis still in progress")
    if log.status == "error":
        raise HTTPException(status_code=500, detail="Analysis failed")

    analysis = db.query(Analysis).filter(Analysis.log_file_id == log_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return AnalysisOut(
        id=analysis.id,
        log_file_id=analysis.log_file_id,
        summary=analysis.summary,
        timeline=[TimelineEvent(**e) for e in json.loads(analysis.timeline or "[]")],
        anomalies=[AnomalyItem(**a) for a in json.loads(analysis.anomalies or "[]")],
        total_entries=analysis.total_entries,
        anomaly_count=analysis.anomaly_count,
        created_at=analysis.created_at,
    )