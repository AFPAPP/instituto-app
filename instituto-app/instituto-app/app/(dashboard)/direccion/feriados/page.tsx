'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Feriado { id: string; fecha: string; descripcion: string | null }

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatFecha(f: string) {
  const d = new Date(f + 'T12:00:00')
  return `${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function diaSemana(f: string) {
  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  return dias[new Date(f + 'T12:00:00').getDay()]
}

export default function FeriadosPage() {
  const supabase = createClient()
  const [feriados, setFeriados] = useState<Feriado[]>([])
  const [form, setForm] = useState({ fecha: '', descripcion: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await supabase.from('feriados').select('*').order('fecha')
    setFeriados(data || [])
  }
  useEffect(() => { load() }, [])

  async function agregar() {
    if (!form.fecha) { setMsg('Selecciona una fecha'); return }
    setSaving(true); setMsg('')
    const { error } = await supabase.from('feriados').insert({ fecha: form.fecha, descripcion: form.descripcion || null })
    if (error) { setMsg(error.message) }
    else { setForm({ fecha: '', descripcion: '' }); load() }
    setSaving(false)
  }

  async function eliminar(id: string, desc: string) {
    if (!confirm(`¿Eliminar el feriado "${desc}"?`)) return
    await supabase.from('feriados').delete().eq('id', id)
    load()
  }

  const porMes: Record<string, Feriado[]> = {}
  feriados.forEach(f => {
    const mes = f.fecha.slice(0, 7)
    if (!porMes[mes]) porMes[mes] = []
    porMes[mes].push(f)
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Días feriados</h1>
        <p className="text-[#6B8294] text-sm mt-1">Los feriados aparecen en rojo en el calendario de todos los profesores. No bloquean la asistencia — el profesor decide si hubo clase ese día.</p>
      </div>

      <div className="card mb-6">
        <h2 className="font-semibold text-[#3E5C76] mb-3 text-sm">Agregar feriado</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs font-medium text-[#6B8294] mb-1">Fecha</label>
            <input type="date" className="input" style={{ width:'160px' }}
              value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
          </div>
          <div className="flex-1" style={{ minWidth:'200px' }}>
            <label className="block text-xs font-medium text-[#6B8294] mb-1">Descripción</label>
            <input type="text" className="input" placeholder="Ej: Día de la Independencia"
              value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && agregar()} />
          </div>
          <button onClick={agregar} disabled={saving} className="btn-primary btn-sm" style={{ padding:'8px 16px', fontSize:'13px' }}>
            {saving ? 'Guardando...' : '+ Agregar'}
          </button>
        </div>
        {msg && <p className="text-[#BC4A3C] text-xs mt-2">{msg}</p>}
      </div>

      {feriados.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-[#9CA8B3] text-sm">No hay feriados registrados aún.</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Agrega los días feriados del año para que aparezcan en los calendarios.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(porMes).map(([mes, items]) => {
            const [anio, numMes] = mes.split('-')
            const titulo = `${MESES[parseInt(numMes) - 1]} ${anio}`
            return (
              <div key={mes} className="card p-0 overflow-hidden">
                <div className="bg-[#3E5C76] px-4 py-2">
                  <p className="text-sm font-semibold text-[#FAF3E8]">{titulo}</p>
                </div>
                <div className="divide-y divide-[#E8DFCF]">
                  {items.map(f => (
                    <div key={f.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-4">
                        <div style={{ background:'#FFCDD2', borderRadius:'8px', padding:'6px 12px', textAlign:'center', minWidth:'52px' }}>
                          <p style={{ fontSize:'18px', fontWeight:600, color:'#B71C1C', margin:0, lineHeight:1 }}>
                            {new Date(f.fecha + 'T12:00:00').getDate()}
                          </p>
                          <p style={{ fontSize:'10px', color:'#BC4A3C', margin:0 }}>
                            {diaSemana(f.fecha).slice(0, 3)}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-[#1a1a1a]">{f.descripcion || 'Sin descripción'}</p>
                          <p className="text-xs text-[#9CA8B3]">{formatFecha(f.fecha)}</p>
                        </div>
                      </div>
                      <button onClick={() => eliminar(f.id, f.descripcion || f.fecha)}
                        className="text-xs text-[#BC4A3C] hover:text-[#8B3228] transition-colors px-2 py-1">
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <p className="text-xs text-[#9CA8B3] text-center">{feriados.length} feriado{feriados.length !== 1 ? 's' : ''} registrado{feriados.length !== 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}
