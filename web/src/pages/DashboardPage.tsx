import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import client from '../api/client'
import { CategoryStat, MonthlyPoint, ProductStat, Summary } from '../types'

const PIE_COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6']

const fmtBaht = (n: number) =>
  n.toLocaleString('th-TH', { maximumFractionDigits: 2 })

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([])
  const [topProducts, setTopProducts] = useState<ProductStat[]>([])
  const [categories, setCategories] = useState<CategoryStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      client.get<Summary>('/analytics/summary'),
      client.get<MonthlyPoint[]>('/analytics/monthly'),
      client.get<ProductStat[]>('/analytics/top-products'),
      client.get<CategoryStat[]>('/analytics/by-category'),
    ])
      .then(([s, m, p, c]) => {
        setSummary(s.data)
        setMonthly(m.data)
        setTopProducts(p.data)
        setCategories(c.data)
      })
      .catch(() => setError('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="page-loading">กำลังโหลดข้อมูล...</div>
  if (error) return <div className="alert alert-error">{error}</div>

  if (summary && summary.total_orders === 0) {
    return (
      <div className="card empty-state">
        <h2>ยังไม่มีข้อมูลยอดขาย</h2>
        <p className="muted">
          เริ่มต้นด้วยการอัปโหลดไฟล์ CSV ยอดขายของคุณ
        </p>
        <Link className="btn btn-primary" to="/upload">
          ไปหน้าอัปโหลด
        </Link>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <h1>แดชบอร์ดยอดขาย</h1>

      <div className="summary-grid">
        <div className="card stat">
          <span className="stat-label">รายได้รวม (บาท)</span>
          <span className="stat-value">{fmtBaht(summary!.total_revenue)}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">จำนวนรายการขาย</span>
          <span className="stat-value">{summary!.total_orders.toLocaleString()}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">จำนวนชิ้นที่ขาย</span>
          <span className="stat-value">{summary!.total_quantity.toLocaleString()}</span>
        </div>
        <div className="card stat">
          <span className="stat-label">มูลค่าเฉลี่ย/รายการ (บาท)</span>
          <span className="stat-value">{fmtBaht(summary!.avg_order_value)}</span>
        </div>
      </div>

      <div className="card chart-card">
        <h2>รายได้รายเดือน</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(v: number) => v.toLocaleString()} />
            <Tooltip formatter={(v) => fmtBaht(Number(v))} />
            <Legend />
            <Line
              type="monotone"
              dataKey="revenue"
              name="รายได้ (บาท)"
              stroke="#4f46e5"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-row">
        <div className="card chart-card">
          <h2>สินค้าขายดี 10 อันดับ</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topProducts} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v: number) => v.toLocaleString()} />
              <YAxis type="category" dataKey="product" width={120} />
              <Tooltip formatter={(v) => fmtBaht(Number(v))} />
              <Bar dataKey="revenue" name="รายได้ (บาท)" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-card">
          <h2>สัดส่วนรายได้ตามหมวดหมู่</h2>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={categories}
                dataKey="revenue"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label={(entry) => entry.category}
              >
                {categories.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmtBaht(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
