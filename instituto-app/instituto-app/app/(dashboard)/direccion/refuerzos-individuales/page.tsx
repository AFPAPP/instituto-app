import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const MESES_ESP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default async function RefuerzosIndividualesPage({ searchParams }: { searchParams: Promise<{ mes?: string; anio?: string }> }) {
  const { mes: mesParam, anio: anioParam } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const hoy = new Date()
  const mesSel  = mesParam  ? parseInt(mesParam)  : hoy.getMonth()
  const anioSel = anioParam ? parseInt(anioParam) : hoy.getFullYear()

  const inicioMes = `${anioSel}-${String(mesSel+1).padStart(2,'0')}-01`
  const finMes    = `${anioSel}-${String(mesSel+1).padStart(2,'0')}-${new Date(anioSel, mesSel+1, 0).getDate()}`

  const { data: refuerzos } = await supabase
    .from('refuerzos')
    .select('*, profesores(id, nombre)')
    .gte('fecha', inicioMes)
    .lte('fecha', finMes)
    .order('fecha')

  const { data: profesores } = await supabase.from('profesores').select('id, nombre').eq('rol', 'profesor').order('nombre')

  function calcularHoras(inicio: string, fin: string) {
    const [h1, m1] = inicio.split(':').map(Number)
    const [h2, m2] = fin.split(':').map(Number)
    const mins = (h2 * 60 + m2) - (h1 * 60 + m1)
    return mins > 0 ? mins / 60 : 0
  }

  // Agrupar por profesor
  const porProfesor: Record<string, { nombre: string; refuerzos: typeof refuerzos; totalHoras: number }> = {}

  refuerzos?.forEach(r => {
    const prof = (r.profesores as {id:string; nombre:string}|null)
    if (!prof) return
    if (!porProfesor[prof.id]) porProfesor[prof.id] = { nombre: prof.nombre, refuerzos: [], totalHoras: 0 }
    porProfesor[prof.id].refuerzos!.push(r)
    porProfesor[prof.id].totalHoras += calcularHoras(r.hora_inicio, r.hora_fin)
  })

  const totalRefuerzos = refuerzos?.length || 0
  const totalHoras = Object.values(porProfesor).reduce((s, p) => s + p.totalHoras, 0)
  const aniosOpts = [2025, 2026, 2027]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">Refuerzos individuales</h1>
          <p className="text-[#6B8294] text-sm mt-1">Registro de clases de refuerzo por profesor</p>
        </div>
        <a href={`/direccion/refuerzos-individuales/imprimir?mes=${mesSel}&anio=${anioSel}`}
          style={{ padding:'8px 16px', background:'#1B5E20', color:'white', borderRadius:'8px', fontSize:'13px', textDecoration:'none', fontWeight:500 }}>
          🖨️ Imprimir reporte
        </a>
      </div>

      {/* Filtros */}
      <div className="card mb-6 flex items-center gap-3 flex-wrap">
        <select className="input" style={{ width:'160px' }} defaultValue={mesSel}>
          {MESES_ESP.map((m, i) => (
            <option key={i} value={i}>
              <a href={`?mes=${i}&anio=${anioSel}`}>{m}</a>
            </option>
          ))}
        </select>
        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
          {MESES_ESP.map((m, i) => (
            <a key={i} href={`?mes=${i}&anio=${anioSel}`}
              style={{ padding:'4px 10px', fontSize:'12px', borderRadius:'6px', textDecoration:'none', border:'1px solid', background: mesSel === i ? '#3E5C76' : 'white', color: mesSel === i ? 'white' : '#9CA8B3', borderColor: mesSel === i ? '#3E5C76' : '#E8DFCF' }}>
              {m.slice(0,3)}
            </a>
          ))}
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          {aniosOpts.map(a => (
            <a key={a} href={`?mes=${mesSel}&anio=${a}`}
              style={{ padding:'4px 10px', fontSize:'12px', borderRadius:'6px', textDecoration:'none', border:'1px solid', background: anioSel === a ? '#3E5C76' : 'white', color: anioSel === a ? 'white' : '#9CA8B3', borderColor: anioSel === a ? '#3E5C76' : '#E8DFCF' }}>
              {a}
            </a>
          ))}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-[#3E5C76]">{totalRefuerzos}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Total refuerzos</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-[#5B21B6]">{totalHoras.toFixed(1)}h</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Total horas</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-[#3E5C76]">{Object.keys(porProfesor).length}</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Profesores</p>
        </div>
      </div>

      {totalRefuerzos === 0 ? (
        <div className="card text-center py-12">
          <p style={{ fontSize:'32px', margin:'0 0 8px' }}>📚</p>
          <p className="text-[#9CA8B3]">No hay refuerzos registrados en {MESES_ESP[mesSel]} {anioSel}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(porProfesor).map(([profId, data]) => (
            <div key={profId} className="card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
                <div>
                  <h2 style={{ fontSize:'16px', fontWeight:600, color:'#3E5C76', margin:0 }}>{data.nombre}</h2>
                  <p style={{ fontSize:'12px', color:'#9CA8B3', margin:'2px 0 0' }}>{data.refuerzos?.length} refuerzo{data.refuerzos?.length !== 1 ? 's' : ''}</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontSize:'20px', fontWeight:600, color:'#5B21B6', margin:0 }}>{data.totalHoras.toFixed(1)}h</p>
                  <p style={{ fontSize:'11px', color:'#9CA8B3', margin:0 }}>total del mes</p>
                </div>
              </div>

              <div style={{ borderRadius:'8px', overflow:'hidden', border:'0.5px solid #E8DFCF' }}>
                <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 80px 80px', background:'#3E5C76', padding:'6px 12px' }}>
                  <p style={{ fontSize:'11px', color:'#FAF3E8', fontWeight:500, margin:0 }}>Fecha</p>
                  <p style={{ fontSize:'11px', color:'#FAF3E8', fontWeight:500, margin:0 }}>Estudiante</p>
                  <p style={{ fontSize:'11px', color:'#FAF3E8', fontWeight:500, margin:0 }}>Horario</p>
                  <p style={{ fontSize:'11px', color:'#FAF3E8', fontWeight:500, margin:0, textAlign:'right' }}>Horas</p>
                </div>
                {data.refuerzos?.map((r, i) => {
                  const horas = calcularHoras(r.hora_inicio, r.hora_fin)
                  return (
                    <div key={r.id} style={{ display:'grid', gridTemplateColumns:'90px 1fr 80px 80px', padding:'8px 12px', borderTop:'0.5px solid #E8DFCF', background: i % 2 === 0 ? 'white' : '#FAF3E8' }}>
                      <p style={{ fontSize:'12px', color:'#6B8294', margin:0 }}>
                        {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-EC', { day:'2-digit', month:'short' })}
                      </p>
                      <div>
                        <p style={{ fontSize:'12px', fontWeight:500, color:'#1a1a1a', margin:0 }}>{r.estudiante_nombre}</p>
                        {r.nivel && <p style={{ fontSize:'10px', color:'#5B21B6', margin:0 }}>{r.nivel}</p>}
                        {r.notas && <p style={{ fontSize:'10px', color:'#9CA8B3', margin:0 }}>{r.notas}</p>}
                      </div>
                      <p style={{ fontSize:'12px', color:'#6B8294', margin:0 }}>{r.hora_inicio.slice(0,5)}—{r.hora_fin.slice(0,5)}</p>
                      <p style={{ fontSize:'12px', fontWeight:500, color:'#5B21B6', margin:0, textAlign:'right' }}>{horas.toFixed(1)}h</p>
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop:'10px', padding:'8px 12px', background:'#EDE9FE', borderRadius:'6px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={{ fontSize:'12px', color:'#5B21B6', margin:0 }}>Total horas de refuerzo — {MESES_ESP[mesSel]} {anioSel}</p>
                <p style={{ fontSize:'14px', fontWeight:600, color:'#5B21B6', margin:0 }}>{data.totalHoras.toFixed(1)} horas</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
