import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import BranchTestingPage from './pages/BranchTestingPage'
import FDRMasterPage from './pages/FDRMasterPage'
import { useState } from 'react'
import bsiLogo from './assets/bsi_logo.png'

export default function App() {
  const { user, loading, login, logout } = useAuth()
  const [activePage, setActivePage] = useState('ojk')

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F0F4F8', fontFamily: 'inherit', fontSize: '14px', color: '#64748B',
    }}>
      Memuat…
    </div>
  )

  if (!user) return <LoginPage onLogin={login} />

  const role = user.role

  if (role === 'viewer') {
    return <DashboardPage user={user} onLogout={logout} />
  }

  if (role === 'branch') {
    return <BranchTestingPage user={user} onLogout={logout} />
  }

  if (role === 'admin') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar — putih */}
        <aside style={{
          width: '200px',
          background: '#fff',
          borderRight: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 0',
          flexShrink: 0,
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          zIndex: 200,
          boxShadow: '2px 0 8px rgba(0,0,0,.04)',
        }}>
          {/* Logo */}
          <div style={{ padding: '0 20px 20px', borderBottom: '1px solid #F1F5F9' }}>
            <img
              src={bsiLogo}
              alt="BSI Logo"
              style={{ height: '36px', objectFit: 'contain', marginBottom: '10px', display: 'block' }}
            />
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A', lineHeight: 1.2 }}>NEOM Dashboard</div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>Admin Panel</div>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: '12px 10px' }}>
            {[
              { key: 'ojk',    label: 'OJK Dashboard',      desc: 'Progress upgrade'   },
              { key: 'branch', label: 'Branch Testing',      desc: 'EXA & T24 Browser'  },
              { key: 'fdr',    label: 'Dashboard Master FDR', desc: 'FDR Overview & Activities' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setActivePage(item.key)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 12px',
                  borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: activePage === item.key ? '#F0FDF9' : 'transparent',
                  marginBottom: '4px', transition: 'background .15s',
                  borderLeft: activePage === item.key ? '3px solid #01847C' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (activePage !== item.key) e.currentTarget.style.background = '#F8FAFC' }}
                onMouseLeave={e => { if (activePage !== item.key) e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <div style={{
                    fontSize: '12px', fontWeight: '600', lineHeight: 1.2,
                    color: activePage === item.key ? '#01847C' : '#0F172A',
                  }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>{item.desc}</div>
                </div>
              </button>
            ))}
          </nav>

          {/* User info + logout */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#0F172A', marginBottom: '2px' }}>{user.name}</div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '10px' }}>Admin BSI</div>
            <button
              onClick={logout}
              style={{
                width: '100%', padding: '7px', border: '1.5px solid #FCA5A5',
                borderRadius: '8px', background: '#FFF1F1', color: '#DC2626',
                fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFF1F1'; e.currentTarget.style.color = '#DC2626' }}
            >
              Keluar
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div style={{ marginLeft: '200px', flex: 1, minWidth: 0 }}>
          {activePage === 'ojk'
            ? <DashboardPage user={user} onLogout={logout} hideSidebar />
            : activePage === 'branch'
            ? <BranchTestingPage user={user} onLogout={logout} hideSidebar />
            : <FDRMasterPage user={user} hideSidebar />
          }
        </div>
      </div>
    )
  }

  return <LoginPage onLogin={login} />
}