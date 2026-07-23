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
    <div className="min-h-screen bg-[#FAF3E8] flex flex-col">
      <div className="tricolor-stripe" />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#3E5C76] text-[#FAF3E8] flex items-center justify-center text-2xl font-bold mx-auto mb-4">AFP</div>
            <h1 className="text-2xl font-bold text-[#3E5C76]">Alliance Française</h1>
            <p className="text-[#6B8294] mt-1 text-sm">Portoviejo — Sistema de gestión</p>
          </div>
          <div className="card">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#3E5C76] mb-1.5">Correo electrónico</label>
                <input type="email" className="input" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3E5C76] mb-1.5">Contraseña</label>
                <input type="password" className="input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              {error && <p className="text-[#BC4A3C] text-sm bg-red-50 p-2 rounded-lg">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center flex items-center gap-2 py-3">
                {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                {loading ? 'Entrando...' : 'Iniciar sesión'}
              </button>
            </form>
          </div>
          <p className="text-center text-xs text-[#9CA8B3] mt-6">Sistema exclusivo del instituto · Acceso solo para personal autorizado</p>
        </div>
      </div>
    </div>
  )
}
