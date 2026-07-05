import { useEffect, useState } from 'react'
import client from '../api/client'
import { Upload } from '../types'

export default function UploadsPage() {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    client
      .get<Upload[]>('/uploads')
      .then((res) => setUploads(res.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  if (loading) return <div className="page-loading">กำลังโหลด...</div>

  return (
    <div>
      <div className="page-head">
        <h1>ประวัติไฟล์ที่อัปโหลด</h1>
        <button className="btn btn-outline" onClick={load}>
          รีเฟรช
        </button>
      </div>
      {uploads.length === 0 ? (
        <div className="card empty-state">
          <p className="muted">ยังไม่เคยอัปโหลดไฟล์</p>
        </div>
      ) : (
        <div className="card table-scroll">
          <table>
            <thead>
              <tr>
                <th>ไฟล์</th>
                <th>วันที่อัปโหลด</th>
                <th>สถานะ</th>
                <th>แถวที่นำเข้า</th>
                <th>แถวที่ข้าม</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id}>
                  <td>{u.filename}</td>
                  <td>{new Date(u.created_at).toLocaleString('th-TH')}</td>
                  <td>
                    <span className={`badge badge-${u.status}`}>{u.status}</span>
                    {u.status === 'error' && u.error_message && (
                      <div className="muted small">{u.error_message}</div>
                    )}
                  </td>
                  <td>{u.total_rows.toLocaleString()}</td>
                  <td>{u.skipped_rows.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
