'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Profesor { id:string; nombre:string; email:string; rol:string; user_id:string|null }

export default function UsuariosPage() {
  const supabase = createClient()
  const [profesores, setProfesores] = useState<Profesor[]>([])
  const [form, setForm] = useState({ nombre:'', email:'', password:'', rol:'profesor' })
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await supabase.from('profesores').select('*').order('nombre')
    setProfesores(data || [])
  }
  useEffect(() => { load() }, [])

  async function crearUsuario() {
    if (!form.nombre || !form.email || !form.password) { setMsg('Completa todos los campos'); return }
    setSaving(true); setMsg('')
    const { data, error } = await supabase.auth.admin.createUser({
      email: form.email, password: form.password, email_confirm: true,
    }).catch(() => ({ data: null, error: { message: 'No tienes permisos de admin' } }))
    if (error || !data?.user) {
      setMsg('Para crear usuarios necesitas usar el panel de Supabase directamente. Ve a Authentication → Users → Invite user.')
      setSaving(false); return
    }
    await supabase.from('profesores').insert({ user_id: data.user.id, nombre: form.nombre, email: form.email, rol: form.rol })
    setShowForm(false); setForm({ nombre:'', email:'', password:'', rol:'profesor' }); setSaving(false); load()
  }

  const ROL_BADGE: Record<string,string> = { profesor:'badge-info', direccion:'badge-purple' }
  const ROL_LABEL: Record<string,string> = { profesor:'Profesor', direccion:'Dirección' }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Usuarios</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ Agregar usuario</button>
      </div>

      <div className="card mb-6 border-[#3E5C76] border bg-blue-50">
        <p className="text-sm text-[#3E5C76] font-medium mb-1">¿Cómo crear cuentas para profesores?</p>
        <p className="text-xs text-[#6B8294]">1. Ve a <strong>supabase.com</strong> → tu proyecto → <strong>Authentication → Users</strong></p>
        <p className="text-xs text-[#6B8294]">2. Haz clic en <strong>"Invite user"</strong> e ingresa el correo del profesor</p>
        <p className="text-xs text-[#6B8294]">3. El profesor recibirá un email para configurar su contraseña</p>
        <p className="text-xs text-[#6B8294]">4. Luego registra sus datos abajo con su nombre y correo para que el sistema lo reconozca</p>
      </div>

      {showForm && (
        <div className="card mb-4">
          <h2 className="font-semibold text-[#3E5C76] mb-3">Registrar usuario</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Nombre completo</label>
              <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Correo</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><label className="block text-xs font-medium text-[#6B8294] mb-1">Rol</label>
              <select className="input" value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                <option value="profesor">Profesor</option>
                <option value="direccion">Dirección</option>
              </select></div>
          </div>
          {msg && <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">{msg}</div>}
          <p className="text-xs text-[#9CA8B3] mt-3">Nota: Primero invita al usuario desde el panel de Supabase, luego regístralo aquí con su nombre.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={crearUsuario} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Registrar'}</button>
            <button onClick={() => { setShowForm(false); setMsg('') }} className="btn-secondary">Cancelar</button>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-[#E8DFCF]">
          {profesores.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 hover:bg-[#FAF3E8] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#3E5C76] text-[#FAF3E8] flex items-center justify-center text-sm font-semibold">
                  {p.nombre.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm text-[#1a1a1a]">{p.nombre}</p>
                  <p className="text-xs text-[#9CA8B3]">{p.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={ROL_BADGE[p.rol]}>{ROL_LABEL[p.rol]}</span>
                {!p.user_id && <span className="badge-warning">Sin cuenta</span>}
              </div>
            </div>
          ))}
          {profesores.length === 0 && <div className="p-8 text-center text-[#9CA8B3] text-sm">No hay usuarios registrados.</div>}
        </div>
      </div>
    </div>
  )
}
