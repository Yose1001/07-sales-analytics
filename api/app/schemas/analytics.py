from pydantic import BaseModel


class SummaryOut(BaseModel):
    total_revenue: float
    total_quantity: int
    total_orders: int
    product_count: int
    avg_order_value: float


class MonthlyPoint(BaseModel):
    month: str  # เช่น "2026-01"
    revenue: float
    quantity: int


class ProductStat(BaseModel):
    product: str
    revenue: float
    quantity: int


class CategoryStat(BaseModel):
    category: str
    revenue: float
