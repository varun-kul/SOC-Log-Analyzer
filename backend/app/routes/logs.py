import os, uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, LogFile
from app.schemas import LogFileOut
from app.routes.auth import get_current_user
from app.services.ai_analyzer import analyze_log_file
from app.config import settings
from typing import List

router = APIRouter()
ALLOWED_EXTENSIONS = {".log", ".txt", ".csv"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

@router.post("/upload", response_model=LogFileOut, status_code=201)
async def upload_log(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, stored_name)
    with open(file_path, "wb") as f:
        f.write(contents)

    log_file = LogFile(
        filename=stored_name,
        original_filename=file.filename,
        file_path=file_path,
        file_size=len(contents),
        owner_id=current_user.id,
    )
    db.add(log_file)
    db.commit()
    db.refresh(log_file)

    # Kick off analysis in the background
    background_tasks.add_task(analyze_log_file, log_file.id)

    return log_file

@router.get("/", response_model=List[LogFileOut])
def list_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(LogFile).filter(LogFile.owner_id == current_user.id).order_by(LogFile.uploaded_at.desc()).all()

@router.get("/{log_id}", response_model=LogFileOut)
def get_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.query(LogFile).filter(LogFile.id == log_id, LogFile.owner_id == current_user.id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log file not found")
    return log

@router.delete("/{log_id}", status_code=204)
def delete_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.query(LogFile).filter(LogFile.id == log_id, LogFile.owner_id == current_user.id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log file not found")
    if os.path.exists(log.file_path):
        os.remove(log.file_path)
    db.delete(log)
    db.commit()