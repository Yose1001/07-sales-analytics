import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Upload, User
from app.schemas.upload import UploadOut
from app.workers.tasks import process_upload

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("", response_model=UploadOut, status_code=201)
def create_upload(
    file: UploadFile,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="รองรับเฉพาะไฟล์ .csv")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_path = upload_dir / f"{uuid.uuid4().hex}.csv"

    size = 0
    with stored_path.open("wb") as out:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_FILE_SIZE:
                stored_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="ไฟล์ใหญ่เกิน 20 MB")
            out.write(chunk)

    upload = Upload(
        user_id=user.id, filename=file.filename, stored_path=str(stored_path)
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)

    process_upload.delay(upload.id)
    return upload


@router.get("", response_model=list[UploadOut])
def list_uploads(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return db.scalars(
        select(Upload)
        .where(Upload.user_id == user.id)
        .order_by(Upload.created_at.desc())
    ).all()


@router.get("/{upload_id}", response_model=UploadOut)
def get_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    upload = db.get(Upload, upload_id)
    if upload is None or upload.user_id != user.id:
        raise HTTPException(status_code=404, detail="ไม่พบไฟล์อัปโหลดนี้")
    return upload
