from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.analytics import CategoryStat, MonthlyPoint, ProductStat, SummaryOut
from app.services import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=SummaryOut)
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return analytics_service.summary(db, user.id)


@router.get("/monthly", response_model=list[MonthlyPoint])
def monthly(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return analytics_service.monthly(db, user.id)


@router.get("/top-products", response_model=list[ProductStat])
def top_products(
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return analytics_service.top_products(db, user.id, limit)


@router.get("/by-category", response_model=list[CategoryStat])
def by_category(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return analytics_service.by_category(db, user.id)
