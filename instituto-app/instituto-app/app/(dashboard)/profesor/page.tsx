import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const estadoBadge: Record<string, string> = {
  en_curso:    'badge-success',
  por_iniciar: 'badge-warning',
  finalizado:  'badge-gray',
  pausado:     'badge-danger',
}
const estadoLabel: Record<string, string> = {
  en_curso:    'En curso',
  por_iniciar: 'Por iniciar',
  finalizado:  'Finalizado',
  pausado:     'Pausado',
}
const modalidadColor: Record<string, string> = {
  Presencial: 'badge-info',
  Virtual:    'badge-purple',
  Híbrido:    'badge-warning',
}

export default async function ProfesorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profesor } = await supabase
    .from('profesores').select('id, nombre, rol').eq('user_id', user.id).single()
  if (!profesor) redirect('/')
  if (profesor.rol === 'direccion') redirect('/direccion')

  const { data: modulos } = await supabase
    .from('modulos')
    .select('id, nivel, modulo, grupo, modalidad, dias, horas_sesion, fecha_inicio, fecha_fin, estado')
    .eq('profesor_id', profesor.id)
    .order('estado', { ascending: false })

  const activos  = modulos?.filter(m => m.estado !== 'finalizado') || []
  const pasados  = modulos?.filter(m => m.estado === 'finalizado') || []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Mis cursos</h1>
        <p className="text-[#6B8294] text-sm mt-1">Bienvenido, {profesor.nombre}</p>
      </div>

      {activos.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-[#6B8294]">No tienes cursos asignados aún.</p>
          <p className="text-sm text-[#9CA8B3] mt-1">Contacta a la dirección para que configure tus módulos.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {activos.map(m => (
          <div key={m.id} className="card hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <h2 className="font-semibold text-[#3E5C76] text-base">{m.nivel} — {m.modulo}</h2>
              <span className={estadoBadge[m.estado]}>{estadoLabel[m.estado]}</span>
            </div>
            <p className="text-xs text-[#9CA8B3] mb-1">Grupo: {m.grupo}</p>
            <div className="flex flex-wrap gap-1 mb-3">
              <span className={modalidadColor[m.modalidad]}>{m.modalidad}</span>
              <span className="badge-gray">{(m.dias as string[]).join(' / ')}</span>
              <span className="badge-gray">{m.horas_sesion}h/sesión</span>
            </div>
            {m.fecha_inicio && m.fecha_fin && (
              <p className="text-xs text-[#9CA8B3] mb-4">
                {new Date(m.fecha_inicio + 'T12:00:00').toLocaleDateString('es-EC', { day:'2-digit', month:'short' })} →{' '}
                {new Date(m.fecha_fin + 'T12:00:00').toLocaleDateString('es-EC', { day:'2-digit', month:'short', year:'numeric' })}
              </p>
            )}
            <div className="flex gap-2">
              <Link href={`/profesor/curso/${m.id}`} className="btn-primary btn-sm flex-1 text-center">Ver curso</Link>
            </div>
          </div>
        ))}
      </div>

      {pasados.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[#9CA8B3] uppercase tracking-wide mb-3">Cursos finalizados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pasados.map(m => (
              <Link key={m.id} href={`/profesor/curso/${m.id}`} className="card opacity-70 hover:opacity-100 transition-opacity">
                <div className="flex justify-between items-start">
                  <h3 className="font-medium text-[#3E5C76] text-sm">{m.nivel} — {m.modulo}</h3>
                  <span className={estadoBadge[m.estado]}>{estadoLabel[m.estado]}</span>
                </div>
                <p className="text-xs text-[#9CA8B3] mt-1">{m.grupo}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
