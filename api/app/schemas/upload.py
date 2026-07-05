from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UploadOut(BaseModel):
    id: int
    filename: str
    status: str
    error_message: Optional[str] = None
    total_rows: int
    skipped_rows: int
    created_at: datetime

    model_config = {"from_attributes": True}
