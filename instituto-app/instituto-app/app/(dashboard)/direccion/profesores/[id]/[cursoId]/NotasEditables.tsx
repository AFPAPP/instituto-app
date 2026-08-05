'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Estudiante { id: string; apellido: string; nombre: string }
interface NotaReg { estudiante_id: string; p_oral: number|null; p_escrita: number|null; c_oral: number|null; c_escrita: number|null }
type NotaForm = { p_oral: number|null; p_escrita: number|null; c_oral: number|null; c_escrita: number|null }

export default function NotasEditables({ estudiantes, notasIniciales }: {
  estudiantes: Estudiante[]
  notasIniciales: NotaReg[]
}) {
  const supabase = createClient()
  const [notas, setNotas] = useState<Record<string, NotaForm>>(() => {
    const map: Record<string, NotaForm> = {}
    estudiantes.forEach(e => { map[e.id] = { p_oral:null, p_escrita:null, c_oral:null, c_escrita:null } })
    notasIniciales.forEach(n => { map[n.estudiante_id] = { p_oral:n.p_oral, p_escrita:n.p_escrita, c_oral:n.c_oral, c_escrita:n.c_escrita } })
    return map
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function setNota(estId: string, campo: keyof NotaForm, val: string) {
    const n = val === '' ? null : Math.min(25, Math.max(0, parseFloat(val) || 0))
    setNotas(prev => ({ ...prev, [estId]: { ...prev[estId], [campo]: n } }))
    setSaved(false)
  }

  async function guardar() {
    setSaving(true)
    const upserts = Object.entries(notas).map(([estudiante_id, n]) => ({ estudiante_id, ...n }))
    await supabase.from('notas').upsert(upserts, { onConflict: 'estudiante_id' })
    setSaving(false)
    setSaved(true)
  }

  function total(n: NotaForm) {
    if (n.p_oral === null || n.p_escrita === null || n.c_oral === null || n.c_escrita === null) return null
    return Math.round((n.p_oral + n.p_escrita + n.c_oral + n.c_escrita) * 100) / 100
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={guardar} disabled={saving}
          style={{ padding:'6px 16px', fontSize:'12px', background:'#3E5C76', color:'white', border:'none', borderRadius:'8px', cursor:'pointer' }}>
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar notas'}
        </button>
      </div>
      <div className="card p-0 overflow-hidden">
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
          <thead>
            <tr>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px 10px', textAlign:'left', minWidth:'140px' }}>Estudiante</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center', width:'70px' }}>P. Oral</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center', width:'70px' }}>P. Escrita</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center', width:'70px' }}>C. Oral</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center', width:'70px' }}>C. Escrita</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center', width:'60px' }}>Total</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center', width:'80px' }}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {estudiantes.map((e, i) => {
              const n = notas[e.id] || { p_oral:null, p_escrita:null, c_oral:null, c_escrita:null }
              const t = total(n)
              const aprobado = t !== null && t >= 50
              return (
                <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#FAF3E8' }}>
                  <td style={{ padding:'6px 10px', fontWeight:500, borderBottom:'0.5px solid #E8DFCF' }}>{e.apellido}, {e.nombre}</td>
                  {(['p_oral','p_escrita','c_oral','c_escrita'] as (keyof NotaForm)[]).map(campo => (
                    <td key={campo} style={{ padding:'3px', borderBottom:'0.5px solid #E8DFCF' }}>
                      <input type="number" min="0" max="25" step="0.01"
                        value={n[campo] ?? ''}
                        placeholder="—"
                        onChange={ev => setNota(e.id, campo, ev.target.value)}
                        style={{ width:'100%', border:'1px solid #E8DFCF', borderRadius:'4px', padding:'3px 4px', textAlign:'center', fontSize:'11px', background:'white' }} />
                    </td>
                  ))}
                  <td style={{ padding:'6px', textAlign:'center', fontWeight:700, borderBottom:'0.5px solid #E8DFCF' }}>{t ?? '—'}/100</td>
                  <td style={{ padding:'6px', textAlign:'center', fontWeight:700, borderBottom:'0.5px solid #E8DFCF', color: t === null ? '#9CA8B3' : aprobado ? '#065F46' : '#991B1B', background: t === null ? 'white' : aprobado ? '#D1FAE5' : '#FEE2E2' }}>
                    {t === null ? '—' : aprobado ? 'Aprobado' : 'Reprobado'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#9CA8B3] mt-2 text-center">Cada competencia sobre 25 puntos · Aprueba con mínimo 50/100</p>
      {saved && <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">✓ Notas guardadas</div>}
    </div>
  )
}
