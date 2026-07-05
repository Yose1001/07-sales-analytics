import pandas as pd

from app.database import SessionLocal
from app.models import Sale, Upload
from app.services.analytics_service import invalidate_cache
from app.workers.celery_app import celery_app

REQUIRED_COLUMNS = ["date", "product", "category", "quantity", "unit_price"]


@celery_app.task(name="process_upload")
def process_upload(upload_id: int) -> None:
    db = SessionLocal()
    try:
        upload = db.get(Upload, upload_id)
        if upload is None:
            return
        upload.status = "processing"
        db.commit()

        try:
            total, skipped = _import_csv(db, upload)
        except Exception as exc:
            db.rollback()
            upload = db.get(Upload, upload_id)
            upload.status = "error"
            upload.error_message = str(exc)[:2000]
            db.commit()
            return

        upload.status = "done"
        upload.total_rows = total
        upload.skipped_rows = skipped
        db.commit()
        invalidate_cache(upload.user_id)
    finally:
        db.close()


def _import_csv(db, upload: Upload) -> tuple[int, int]:
    df = pd.read_csv(upload.stored_path)
    df.columns = [str(c).strip().lower() for c in df.columns]

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(
            f"ไฟล์ขาดคอลัมน์: {', '.join(missing)} "
            f"(ต้องมีคอลัมน์ {', '.join(REQUIRED_COLUMNS)})"
        )

    before = len(df)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["quantity"] = pd.to_numeric(df["quantity"], errors="coerce")
    df["unit_price"] = pd.to_numeric(df["unit_price"], errors="coerce")
    df = df.dropna(subset=["date", "product", "quantity", "unit_price"])
    df = df[(df["quantity"] > 0) & (df["unit_price"] >= 0)]
    df["product"] = df["product"].astype(str).str.strip()
    df["category"] = df["category"].fillna("ไม่ระบุ").astype(str).str.strip()
    skipped = before - len(df)

    if len(df) == 0:
        raise ValueError("ไม่มีแถวข้อมูลที่ใช้ได้ในไฟล์นี้")

    sales = [
        Sale(
            upload_id=upload.id,
            user_id=upload.user_id,
            sale_date=row.date.date(),
            product=row.product,
            category=row.category,
            quantity=int(row.quantity),
            unit_price=round(float(row.unit_price), 2),
            total=round(int(row.quantity) * float(row.unit_price), 2),
        )
        for row in df.itertuples(index=False)
    ]
    db.add_all(sales)
    return len(sales), skipped
