import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const ESTADO_BADGE: Record<string,string> = { por_iniciar:'badge-warning', en_curso:'badge-success', finalizado:'badge-gray', pausado:'badge-danger' }
const ESTADO_LABEL: Record<string,string> = { por_iniciar:'Por iniciar', en_curso:'En curso', finalizado:'Finalizado', pausado:'Pausado' }

export default async function ProfesorDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const { data: prof } = await supabase.from('profesores').select('id, nombre, correo').eq('id', id).single()
  if (!prof) redirect('/direccion/profesores')

  const { data: modulos } = await supabase
    .from('modulos')
    .select('id, nivel, modulo, grupo, estado, fecha_inicio, fecha_fin, modalidad, dias, horas_sesion')
    .eq('profesor_id', id)
    .order('fecha_inicio', { ascending: false })

  const iniciales = prof.nombre.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  const activos    = modulos?.filter(m => m.estado !== 'finalizado') || []
  const finalizados = modulos?.filter(m => m.estado === 'finalizado') || []

  return (
    <div>
      <div className="mb-1">
        <Link href="/direccion/profesores" className="text-[#9CA8B3] text-sm hover:text-[#3E5C76]">← Volver a Profesores</Link>
      </div>

      <div className="flex items-center gap-4 mb-6 mt-3">
        <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'#3E5C76', color:'#FAF3E8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', fontWeight:600, flexShrink:0 }}>
          {iniciales}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">{prof.nombre}</h1>
          <p className="text-[#6B8294] text-sm">{prof.correo}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-[#3E5C76]">{modulos?.length || 0}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Total módulos</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-700">{activos.length}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Activos</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-[#9CA8B3]">{finalizados.length}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Finalizados</p>
        </div>
      </div>

      {activos.length > 0 && (
        <div className="mb-6">
          <h2 className="font-semibold text-[#3E5C76] mb-3">Cursos activos</h2>
          <div className="card p-0 overflow-hidden">
            {activos.map((m, i) => (
              <div key={m.id} style={{ borderBottom: i < activos.length-1 ? '0.5px solid #E8DFCF' : 'none' }}>
                <Link href={`/direccion/profesores/${id}/curso/${m.id}`} style={{ textDecoration:'none', display:'block', padding:'12px 16px' }}
                  className="hover:bg-[#FAF3E8] transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-medium text-sm text-[#1a1a1a]">{m.nivel} — {m.modulo} <span className="text-[#9CA8B3] font-normal">({m.grupo})</span></p>
                      <p className="text-xs text-[#9CA8B3] mt-0.5">{m.modalidad} · {(m.dias as string[]).join('/')} · {m.horas_sesion}h/sesión · {m.fecha_inicio} → {m.fecha_fin}</p>
                    </div>
                    <span className={ESTADO_BADGE[m.estado]}>{ESTADO_LABEL[m.estado]}</span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {finalizados.length > 0 && (
        <div>
          <h2 className="font-semibold text-[#3E5C76] mb-3">Cursos finalizados</h2>
          <div className="card p-0 overflow-hidden">
            {finalizados.map((m, i) => (
              <div key={m.id} style={{ borderBottom: i < finalizados.length-1 ? '0.5px solid #E8DFCF' : 'none', opacity:0.65 }}>
                <Link href={`/direccion/profesores/${id}/curso/${m.id}`} style={{ textDecoration:'none', display:'block', padding:'12px 16px' }}
                  className="hover:bg-[#FAF3E8] transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-medium text-sm text-[#1a1a1a]">{m.nivel} — {m.modulo} <span className="text-[#9CA8B3] font-normal">({m.grupo})</span></p>
                      <p className="text-xs text-[#9CA8B3] mt-0.5">{m.modalidad} · {(m.dias as string[]).join('/')} · {m.horas_sesion}h/sesión · {m.fecha_inicio} → {m.fecha_fin}</p>
                    </div>
                    <span className={ESTADO_BADGE[m.estado]}>{ESTADO_LABEL[m.estado]}</span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!modulos || modulos.length === 0) && (
        <div className="card text-center py-12">
          <p className="text-[#9CA8B3]">Este profesor no tiene módulos asignados.</p>
        </div>
      )}
    </div>
  )
}
