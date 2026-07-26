'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) { setError('Correo o contraseña incorrectos'); setLoading(false); return }
    if (data.user) {
      const { data: prof } = await supabase.from('profesores').select('rol').eq('user_id', data.user.id).single()
      if (prof?.rol === 'direccion') router.push('/direccion')
      else router.push('/profesor')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', backgroundColor:'#FAF3E8', display:'flex', flexDirection:'column' }}>
      <div className="tricolor-stripe" />
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'1.5rem' }}>
        <div style={{ width:'100%', maxWidth:'360px' }}>
          <div style={{ textAlign:'center', marginBottom:'2rem' }}>
            <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'#3E5C76', color:'#FAF3E8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', fontWeight:600, margin:'0 auto 14px', fontFamily:'Inter,sans-serif' }}>
              AFP
            </div>
            <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:'24px', fontWeight:500, color:'#3E5C76', margin:0 }}>
              Alliance Française
            </h1>
            <p style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:'13px', color:'#BC4A3C', fontStyle:'italic', margin:'4px 0 0' }}>
              Portoviejo — Système de gestion
            </p>
          </div>
          <div className="card">
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom:'14px' }}>
                <label style={{ display:'block', fontSize:'12px', fontWeight:500, color:'#3E5C76', marginBottom:'5px', fontFamily:'Inter,sans-serif' }}>Correo electrónico</label>
                <input type="email" className="input" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div style={{ marginBottom:'18px' }}>
                <label style={{ display:'block', fontSize:'12px', fontWeight:500, color:'#3E5C76', marginBottom:'5px', fontFamily:'Inter,sans-serif' }}>Contraseña</label>
                <input type="password" className="input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              {error && <p style={{ fontSize:'13px', color:'#BC4A3C', background:'#FEE2E2', padding:'8px 12px', borderRadius:'8px', marginBottom:'14px' }}>{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary"
                style={{ width:'100%', textAlign:'center', padding:'10px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
                {loading && <span style={{ width:'14px', height:'14px', border:'2px solid #FAF3E8', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} />}
                {loading ? 'Entrando...' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
          <p style={{ textAlign:'center', fontSize:'11px', color:'#9CA8B3', marginTop:'1.5rem', fontFamily:'Inter,sans-serif' }}>
            Sistema exclusivo del instituto · Acceso solo para personal autorizado
          </p>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
