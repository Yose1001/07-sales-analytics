import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">📊 Sales Analytics</span>
          <nav>
            <NavLink to="/" end>
              แดชบอร์ด
            </NavLink>
            <NavLink to="/upload">อัปโหลด</NavLink>
            <NavLink to="/uploads">ประวัติไฟล์</NavLink>
          </nav>
          <div className="topbar-user">
            <span>{user?.name}</span>
            <button className="btn btn-outline" onClick={logout}>
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  )
}
