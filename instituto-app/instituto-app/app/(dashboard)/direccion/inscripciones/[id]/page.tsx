import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CambiarEstadoBtn from './CambiarEstadoBtn'

export default async function InscripcionDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const { data: ins } = await supabase.from('inscripciones').select('*').eq('id', id).single()
  if (!ins) redirect('/direccion/inscripciones')

  const ESTADO_BADGE: Record<string, string> = {
    'Pendiente': 'badge-warning',
    'Procesada': 'badge-success',
    'En espera': 'badge-gray',
    'Rechazada': 'badge-danger',
  }

  function Fila({ label, value }: { label: string; value: string | null }) {
    if (!value) return null
    return (
      <div style={{ display:'flex', gap:'12px', padding:'8px 0', borderBottom:'0.5px solid #E8DFCF' }}>
        <span style={{ fontSize:'12px', color:'#9CA8B3', minWidth:'200px', flexShrink:0 }}>{label}</span>
        <span style={{ fontSize:'13px', color:'#1a1a1a' }}>{value}</span>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <Link href="/direccion/inscripciones" className="text-[#9CA8B3] text-sm hover:text-[#3E5C76]">← Volver a Inscripciones</Link>
      </div>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">{ins.apellidos}, {ins.nombres}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={ESTADO_BADGE[ins.estado] || 'badge-gray'}>{ins.estado}</span>
            <span className="text-xs text-[#9CA8B3]">
              Recibida el {new Date(ins.created_at).toLocaleDateString('es-EC', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })}
            </span>
          </div>
        </div>
        <CambiarEstadoBtn id={ins.id} estadoActual={ins.estado} />
      </div>

      {/* Datos personales */}
      <div className="card mb-4">
        <h2 className="font-semibold text-[#3E5C76] mb-3 text-sm">1. Datos personales</h2>
        <Fila label="Nombres" value={ins.nombres} />
        <Fila label="Apellidos" value={ins.apellidos} />
        <Fila label="Cédula o pasaporte" value={ins.cedula} />
        <Fila label="Fecha de nacimiento" value={ins.fecha_nacimiento} />
        <Fila label="Correo electrónico" value={ins.correo} />
        <Fila label="Teléfono celular" value={ins.telefono} />
        <Fila label="Ocupación / Profesión" value={ins.ocupacion} />
        <Fila label="Sexo" value={ins.sexo} />
        <Fila label="Ciudad" value={ins.ciudad} />
        <Fila label="Provincia" value={ins.provincia} />
        <Fila label="Dirección" value={ins.direccion} />
      </div>

      {/* Interés en el curso */}
      <div className="card mb-4">
        <h2 className="font-semibold text-[#3E5C76] mb-3 text-sm">2. Interés en el curso</h2>
        <Fila label="Nivel de francés actual" value={ins.nivel_actual} />
        <Fila label="Módulo de interés" value={ins.modulo_interes} />
        <Fila label="Razón para aprender francés" value={ins.razon_aprender} />
        <Fila label="Cómo conoció la AFP" value={ins.como_conocio} />
      </div>

      {/* Facturación */}
      <div className="card mb-4">
        <h2 className="font-semibold text-[#3E5C76] mb-3 text-sm">3. Datos de facturación</h2>
        <Fila label="Factura a nombre del alumno" value={ins.factura_nombre_alumno} />
        <Fila label="Datos para la factura" value={ins.datos_factura} />
        <Fila label="Tiene convenio institucional" value={ins.tiene_convenio} />
        <Fila label="Nombre de la institución" value={ins.nombre_institucion} />
      </div>

      {/* Representante */}
      {ins.nombre_representante && (
        <div className="card mb-4">
          <h2 className="font-semibold text-[#3E5C76] mb-3 text-sm">4. Representante</h2>
          <Fila label="Nombre" value={ins.nombre_representante} />
          <Fila label="Parentesco" value={ins.parentesco} />
          <Fila label="Teléfono" value={ins.telefono_representante} />
          <Fila label="Correo" value={ins.correo_representante} />
          <Fila label="Ocupación" value={ins.ocupacion_representante} />
          <Fila label="Cédula o pasaporte" value={ins.cedula_representante} />
        </div>
      )}

      {/* Particularidades */}
      <div className="card mb-4">
        <h2 className="font-semibold text-[#3E5C76] mb-3 text-sm">5. Particularidades y autorizaciones</h2>
        <Fila label="Tiene discapacidad" value={ins.tiene_discapacidad} />
        <Fila label="Descripción discapacidad" value={ins.descripcion_discapacidad} />
        <Fila label="Autoriza publicación imagen" value={ins.autoriza_imagen} />
        <Fila label="Autoriza uso de datos" value={ins.autoriza_datos} />
      </div>
    </div>
  )
}
