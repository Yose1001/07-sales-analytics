export interface User {
  id: number
  email: string
  name: string
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export type UploadStatus = 'pending' | 'processing' | 'done' | 'error'

export interface Upload {
  id: number
  filename: string
  status: UploadStatus
  error_message: string | null
  total_rows: number
  skipped_rows: number
  created_at: string
}

export interface Summary {
  total_revenue: number
  total_quantity: number
  total_orders: number
  product_count: number
  avg_order_value: number
}

export interface MonthlyPoint {
  month: string
  revenue: number
  quantity: number
}

export interface ProductStat {
  product: string
  revenue: number
  quantity: number
}

export interface CategoryStat {
  category: string
  revenue: number
}
