import axios from 'axios'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { Upload } from '../types'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [upload, setUpload] = useState<Upload | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  const startPolling = (id: number) => {
    pollRef.current = window.setInterval(async () => {
      const res = await client.get<Upload>(`/uploads/${id}`)
      setUpload(res.data)
      if (res.data.status === 'done' || res.data.status === 'error') {
        if (pollRef.current) window.clearInterval(pollRef.current)
      }
    }, 1500)
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return
    setError('')
    setUpload(null)
    setSubmitting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await client.post<Upload>('/uploads', form)
      setUpload(res.data)
      startPolling(res.data.id)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.detail) {
        setError(String(err.response.data.detail))
      } else {
        setError('อัปโหลดไม่สำเร็จ กรุณาลองใหม่')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="upload-page">
      <h1>อัปโหลดไฟล์ยอดขาย</h1>

      <div className="card">
        <h2>รูปแบบไฟล์ CSV ที่รองรับ</h2>
        <p className="muted">ไฟล์ต้องมีหัวคอลัมน์ตามนี้ (ตัวพิมพ์เล็ก):</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>คอลัมน์</th>
                <th>ความหมาย</th>
                <th>ตัวอย่าง</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>date</code></td>
                <td>วันที่ขาย</td>
                <td>2026-01-15</td>
              </tr>
              <tr>
                <td><code>product</code></td>
                <td>ชื่อสินค้า</td>
                <td>ลาเต้เย็น</td>
              </tr>
              <tr>
                <td><code>category</code></td>
                <td>หมวดหมู่</td>
                <td>เครื่องดื่ม</td>
              </tr>
              <tr>
                <td><code>quantity</code></td>
                <td>จำนวนชิ้น</td>
                <td>3</td>
              </tr>
              <tr>
                <td><code>unit_price</code></td>
                <td>ราคาต่อชิ้น (บาท)</td>
                <td>65</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <form className="card" onSubmit={onSubmit}>
        {error && <div className="alert alert-error">{error}</div>}
        <label className="file-input">
          เลือกไฟล์ .csv (ไม่เกิน 20 MB)
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button className="btn btn-primary" disabled={!file || submitting}>
          {submitting ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
        </button>
      </form>

      {upload && (
        <div className="card">
          <h2>สถานะการประมวลผล</h2>
          <p>
            ไฟล์: <strong>{upload.filename}</strong>
          </p>
          <p>
            สถานะ: <span className={`badge badge-${upload.status}`}>{statusText(upload.status)}</span>
          </p>
          {upload.status === 'done' && (
            <>
              <p>
                นำเข้าสำเร็จ {upload.total_rows.toLocaleString()} แถว
                {upload.skipped_rows > 0 &&
                  ` (ข้ามแถวที่ข้อมูลไม่ถูกต้อง ${upload.skipped_rows} แถว)`}
              </p>
              <Link className="btn btn-primary" to="/">
                ไปดูแดชบอร์ด
              </Link>
            </>
          )}
          {upload.status === 'error' && (
            <div className="alert alert-error">{upload.error_message}</div>
          )}
        </div>
      )}
    </div>
  )
}

function statusText(status: string) {
  switch (status) {
    case 'pending':
      return 'รอคิว'
    case 'processing':
      return 'กำลังประมวลผล'
    case 'done':
      return 'สำเร็จ'
    case 'error':
      return 'ผิดพลาด'
    default:
      return status
  }
}
