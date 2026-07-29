'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function CambiarEstadoBtn({ id, estadoActual }: { id: string; estadoActual: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [estado, setEstado] = useState(estadoActual)
  const [saving, setSaving] = useState(false)

  async function cambiar(nuevoEstado: string) {
    setSaving(true)
    await supabase.from('inscripciones').update({ estado: nuevoEstado }).eq('id', id)
    setEstado(nuevoEstado)
    setSaving(false)
    router.refresh()
  }

  const estados = ['Pendiente', 'Procesada', 'En espera', 'Rechazada']

  return (
    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
      {estados.map(e => (
        <button key={e} onClick={() => cambiar(e)} disabled={saving || e === estado}
          style={{
            padding:'5px 12px', fontSize:'12px', borderRadius:'8px', cursor: e === estado ? 'default' : 'pointer', border:'1px solid',
            background: e === estado ? '#3E5C76' : 'transparent',
            color: e === estado ? 'white' : '#6B8294',
            borderColor: e === estado ? '#3E5C76' : '#E8DFCF',
            opacity: saving ? 0.6 : 1,
          }}>
          {e}
        </button>
      ))}
    </div>
  )
}
