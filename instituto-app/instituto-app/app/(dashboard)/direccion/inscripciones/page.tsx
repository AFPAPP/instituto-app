import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const ESTADO_BADGE: Record<string, string> = {
  'Pendiente':   'badge-warning',
  'Procesada':   'badge-success',
  'En espera':   'badge-gray',
  'Rechazada':   'badge-danger',
}

export default async function InscripcionesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const { data: inscripciones } = await supabase
    .from('inscripciones')
    .select('*')
    .order('created_at', { ascending: false })

  const total = inscripciones?.length || 0
  const pendientes = inscripciones?.filter(i => i.estado === 'Pendiente').length || 0
  const procesadas = inscripciones?.filter(i => i.estado === 'Procesada').length || 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">Inscripciones</h1>
          <p className="text-[#6B8294] text-sm mt-1">Fichas recibidas desde el formulario de inscripción</p>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-[#3E5C76]">{total}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Total recibidas</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-[#92400E]">{pendientes}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Pendientes</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-700">{procesadas}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Procesadas</p>
        </div>
      </div>

      {/* Lista */}
      {(!inscripciones || inscripciones.length === 0) ? (
        <div className="card text-center py-12">
          <p style={{ fontSize:'32px', margin:'0 0 8px' }}>📋</p>
          <p className="text-[#9CA8B3]">No hay inscripciones recibidas aún.</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Las fichas del formulario aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="divide-y divide-[#E8DFCF]">
            {inscripciones.map((ins, i) => (
              <div key={ins.id} style={{ padding:'14px 16px', background: i % 2 === 0 ? 'white' : '#FAF3E8' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'12px', flexWrap:'wrap' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'4px' }}>
                      <span style={{ fontWeight:600, fontSize:'14px', color:'#1a1a1a' }}>{ins.apellidos}, {ins.nombres}</span>
                      <span className={ESTADO_BADGE[ins.estado] || 'badge-gray'}>{ins.estado}</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'4px 16px', fontSize:'12px', color:'#6B8294' }}>
                      {ins.cedula && <span>📋 {ins.cedula}</span>}
                      {ins.correo && <span>✉️ {ins.correo}</span>}
                      {ins.telefono && <span>📱 {ins.telefono}</span>}
                      {ins.ciudad && <span>📍 {ins.ciudad}, {ins.provincia}</span>}
                      {ins.nivel_actual && <span>🎓 {ins.nivel_actual}</span>}
                      {ins.modulo_interes && <span>📚 {ins.modulo_interes}</span>}
                      {ins.como_conocio && <span>💬 {ins.como_conocio}</span>}
                    </div>
                    {ins.tiene_discapacidad === 'Sí, deseo indicarla' && ins.descripcion_discapacidad && (
                      <p style={{ fontSize:'11px', color:'#BC4A3C', marginTop:'4px' }}>
                        ⚠️ Discapacidad: {ins.descripcion_discapacidad}
                      </p>
                    )}
                    <p style={{ fontSize:'10px', color:'#9CA8B3', marginTop:'4px' }}>
                      Recibida: {new Date(ins.created_at).toLocaleDateString('es-EC', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'6px', alignItems:'flex-end', flexShrink:0 }}>
                    <a href={`/direccion/inscripciones/${ins.id}`}
                      style={{ padding:'4px 12px', fontSize:'12px', background:'transparent', color:'#3E5C76', border:'1px solid #3E5C76', borderRadius:'8px', textDecoration:'none', display:'inline-block' }}>
                      Ver detalle
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
