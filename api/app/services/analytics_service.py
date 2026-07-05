import json

import redis as redis_lib
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Sale

CACHE_TTL_SECONDS = 300

_redis = redis_lib.Redis.from_url(settings.redis_url, decode_responses=True)


def _cached(user_id: int, name: str, compute):
    key = f"analytics:{user_id}:{name}"
    try:
        hit = _redis.get(key)
        if hit is not None:
            return json.loads(hit)
    except redis_lib.RedisError:
        # Redis ล่มไม่ควรทำให้ dashboard พัง — คำนวณสดแทน
        return compute()
    result = compute()
    try:
        _redis.set(key, json.dumps(result), ex=CACHE_TTL_SECONDS)
    except redis_lib.RedisError:
        pass
    return result


def invalidate_cache(user_id: int) -> None:
    try:
        keys = _redis.keys(f"analytics:{user_id}:*")
        if keys:
            _redis.delete(*keys)
    except redis_lib.RedisError:
        pass


def summary(db: Session, user_id: int) -> dict:
    def compute():
        row = db.execute(
            select(
                func.coalesce(func.sum(Sale.total), 0),
                func.coalesce(func.sum(Sale.quantity), 0),
                func.count(Sale.id),
                func.count(func.distinct(Sale.product)),
            ).where(Sale.user_id == user_id)
        ).one()
        total_revenue = float(row[0])
        total_orders = int(row[2])
        return {
            "total_revenue": round(total_revenue, 2),
            "total_quantity": int(row[1]),
            "total_orders": total_orders,
            "product_count": int(row[3]),
            "avg_order_value": round(total_revenue / total_orders, 2)
            if total_orders
            else 0.0,
        }

    return _cached(user_id, "summary", compute)


def monthly(db: Session, user_id: int) -> list[dict]:
    def compute():
        month = func.to_char(Sale.sale_date, "YYYY-MM")
        rows = db.execute(
            select(month, func.sum(Sale.total), func.sum(Sale.quantity))
            .where(Sale.user_id == user_id)
            .group_by(month)
            .order_by(month)
        ).all()
        return [
            {"month": r[0], "revenue": float(r[1]), "quantity": int(r[2])}
            for r in rows
        ]

    return _cached(user_id, "monthly", compute)


def top_products(db: Session, user_id: int, limit: int = 10) -> list[dict]:
    def compute():
        revenue = func.sum(Sale.total)
        rows = db.execute(
            select(Sale.product, revenue, func.sum(Sale.quantity))
            .where(Sale.user_id == user_id)
            .group_by(Sale.product)
            .order_by(revenue.desc())
            .limit(limit)
        ).all()
        return [
            {"product": r[0], "revenue": float(r[1]), "quantity": int(r[2])}
            for r in rows
        ]

    return _cached(user_id, f"top_products:{limit}", compute)


def by_category(db: Session, user_id: int) -> list[dict]:
    def compute():
        revenue = func.sum(Sale.total)
        rows = db.execute(
            select(Sale.category, revenue)
            .where(Sale.user_id == user_id)
            .group_by(Sale.category)
            .order_by(revenue.desc())
        ).all()
        return [{"category": r[0], "revenue": float(r[1])} for r in rows]

    return _cached(user_id, "by_category", compute)
