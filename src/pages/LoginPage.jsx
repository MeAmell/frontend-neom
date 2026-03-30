import { useState } from 'react'
import { login } from '../utils/api'
import bsiLogo from '../assets/bsi_logo.png'


export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(username, password)
      sessionStorage.setItem('neom_token', data.token)
      onLogin(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'linear-gradient(135deg, #01847C 0%, #016860 40%, #0F172A 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Blobs */}
      <div style={{ position: 'absolute', top: '-120px', right: '-80px', width: '480px', height: '480px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,160,48,.35) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-100px', left: '-60px', width: '380px', height: '380px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(109,181,185,.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: .06, backgroundImage: 'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Left panel */}
      <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '14px', background: 'rgba(255,255,255,.1)', borderRadius: '16px', padding: '12px 20px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.15)', marginBottom: '40px' }}>
            <img src={bsiLogo} alt="BSI" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain', background: '#fff', padding: '4px' }} />
            <span style={{ color: 'rgba(255,255,255,.9)', fontWeight: '600', fontSize: '15px' }}>Bank Syariah Indonesia</span>
          </div>
          <h1 style={{ fontSize: '52px', fontWeight: '800', lineHeight: '1.1', color: '#fff', marginBottom: '20px', letterSpacing: '-1.5px' }}>
            NEOM<br /><span style={{ color: '#E8A030' }}>Core Banking</span><br />Upgrade
          </h1>
          <p style={{ color: 'rgba(255,255,255,.65)', fontSize: '18px', lineHeight: '1.7', maxWidth: '400px' }}>
            Dashboard pemantauan progress upgrade sistem core banking BSI secara real-time .
          </p>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          {[{ label: 'Total Tasks', value: '1,400' }, { label: 'Total Stage', value: '6' }, { label: 'Update', value: 'Real-time' }].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,.08)', borderRadius: '14px', padding: '20px 24px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.12)' }}>
              <div style={{ fontSize: '26px', fontWeight: '800', color: '#fff', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.5)', marginTop: '4px', fontWeight: '500' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right login card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '100%', maxWidth: '440px', background: 'rgba(255,255,255,.97)', borderRadius: '28px', padding: '48px', boxShadow: '0 32px 80px rgba(0,0,0,.3)' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <img src={bsiLogo} alt="BSI" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain', background: '#fff', padding: '4px' }} />
              <span style={{ fontWeight: '700', fontSize: '18px', color: '#0F172A' }}>NEOM Dashboard</span>
            </div>
            <p style={{ color: '#64748B', fontSize: '14px' }}>Masuk untuk melihat progress upgrade</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Masukkan username" required
                style={{ width: '100%', padding: '13px 16px', border: '1.5px solid #E2E8F0', borderRadius: '12px', fontSize: '15px', outline: 'none', fontFamily: 'inherit', background: '#F8FAFC' }}
                onFocus={e => e.target.style.borderColor = '#01847C'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Masukkan password" required
                  style={{ width: '100%', padding: '13px 48px 13px 16px', border: '1.5px solid #E2E8F0', borderRadius: '12px', fontSize: '15px', outline: 'none', fontFamily: 'inherit', background: '#F8FAFC' }}
                  onFocus={e => e.target.style.borderColor = '#01847C'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '18px' }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: '10px', padding: '12px 16px', fontSize: '14px', fontWeight: '500', border: '1px solid #FECACA' }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '15px', background: loading ? '#94A3B8' : 'linear-gradient(135deg, #01847C, #016860)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 4px 16px rgba(1,132,124,.4)' }}>
              {loading ? <><span className="spinner" /> Memverifikasi...</> : 'Masuk ke Dashboard'}
            </button>
          </form>

          <div style={{ marginTop: '28px', padding: '16px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0' }}>
            <p style={{ fontSize: '12px', color: '#166534', fontWeight: '600', marginBottom: '6px' }}>🔐 Demo Credentials</p>
            <p style={{ fontSize: '12px', color: '#16A34A', fontFamily: 'DM Mono, monospace' }}>OJK: ojk_viewer / OJK@2026!</p>
            <p style={{ fontSize: '12px', color: '#16A34A', fontFamily: 'DM Mono, monospace' }}>Admin: bsi_admin / BSI@Admin2026!</p>
            <p style={{ fontSize: '12px', color: '#16A34A', fontFamily: 'DM Mono, monospace' }}>Branch: branch_team / Branch@2026!</p>
          </div>

          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#94A3B8' }}>© 2026 Bank Syariah Indonesia · Confidential</p>
        </div>
      </div>
    </div>
  )
}