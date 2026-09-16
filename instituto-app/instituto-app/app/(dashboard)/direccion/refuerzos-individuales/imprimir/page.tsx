import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const MESES_ESP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default async function ImprimirRefuerzosPage({ searchParams }: { searchParams: Promise<{ mes?: string; anio?: string }> }) {
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

  function calcularHoras(inicio: string, fin: string) {
    const [h1, m1] = inicio.split(':').map(Number)
    const [h2, m2] = fin.split(':').map(Number)
    const mins = (h2 * 60 + m2) - (h1 * 60 + m1)
    return mins > 0 ? mins / 60 : 0
  }

  const porProfesor: Record<string, { nombre: string; refuerzos: typeof refuerzos; totalHoras: number }> = {}
  refuerzos?.forEach(r => {
    const prof = (r.profesores as {id:string; nombre:string}|null)
    if (!prof) return
    if (!porProfesor[prof.id]) porProfesor[prof.id] = { nombre: prof.nombre, refuerzos: [], totalHoras: 0 }
    porProfesor[prof.id].refuerzos!.push(r)
    porProfesor[prof.id].totalHoras += calcularHoras(r.hora_inicio, r.hora_fin)
  })

  const totalHoras = Object.values(porProfesor).reduce((s, p) => s + p.totalHoras, 0)

  return (
    <div style={{ fontFamily:'Arial, sans-serif', fontSize:'12px', color:'#1a1a1a', maxWidth:'900px', margin:'0 auto', padding:'20px' }}>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }} className="no-print">
        <a href={`/direccion/refuerzos-individuales?mes=${mesSel}&anio=${anioSel}`} style={{ fontSize:'13px', color:'#3E5C76', textDecoration:'none' }}>← Volver</a>
        <a href="javascript:window.print()" style={{ padding:'8px 20px', background:'#3E5C76', color:'white', borderRadius:'8px', fontSize:'14px', fontWeight:500, textDecoration:'none', display:'inline-block' }}>
          🖨️ Imprimir / Guardar PDF
        </a>
      </div>

      {/* Encabezado */}
      <div style={{ background:'#3E5C76', color:'white', padding:'14px 16px', borderRadius:'6px 6px 0 0', marginBottom:'0' }}>
        <div style={{ fontSize:'16px', fontWeight:700, marginBottom:'4px' }}>Alliance Française Portoviejo — Refuerzos Individuales</div>
        <div style={{ fontSize:'12px', opacity:0.85 }}>{MESES_ESP[mesSel]} {anioSel} · Total: {totalHoras.toFixed(1)} horas · {refuerzos?.length || 0} refuerzos</div>
      </div>

      {/* Por profesor */}
      {Object.entries(porProfesor).map(([profId, data]) => (
        <div key={profId} style={{ marginTop:'16px' }}>
          <div style={{ fontSize:'13px', fontWeight:700, color:'#3E5C76', textTransform:'uppercase', letterSpacing:'0.05em', borderBottom:'1.5px solid #3E5C76', paddingBottom:'3px', marginBottom:'8px', display:'flex', justifyContent:'space-between' }}>
            <span>{data.nombre}</span>
            <span style={{ color:'#5B21B6' }}>{data.totalHoras.toFixed(1)}h total</span>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
            <thead>
              <tr>
                <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'left', border:'0.5px solid #aaa', width:'80px' }}>Fecha</th>
                <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'left', border:'0.5px solid #aaa' }}>Estudiante</th>
                <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa', width:'60px' }}>Nivel</th>
                <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa', width:'100px' }}>Horario</th>
                <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'center', border:'0.5px solid #aaa', width:'50px' }}>Horas</th>
                <th style={{ background:'#3E5C76', color:'white', padding:'5px 8px', textAlign:'left', border:'0.5px solid #aaa' }}>Notas</th>
              </tr>
            </thead>
            <tbody>
              {data.refuerzos?.map((r, i) => {
                const horas = calcularHoras(r.hora_inicio, r.hora_fin)
                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? 'white' : '#f9f9f9' }}>
                    <td style={{ padding:'5px 8px', border:'0.5px solid #ccc' }}>
                      {new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-EC', { day:'2-digit', month:'short' })}
                    </td>
                    <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', fontWeight:500 }}>{r.estudiante_nombre}</td>
                    <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center' }}>{r.nivel || '—'}</td>
                    <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center' }}>{r.hora_inicio.slice(0,5)}—{r.hora_fin.slice(0,5)}</td>
                    <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center', fontWeight:600, color:'#5B21B6' }}>{horas.toFixed(1)}h</td>
                    <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', color:'#6B8294' }}>{r.notas || '—'}</td>
                  </tr>
                )
              })}
              <tr style={{ background:'#EDE9FE' }}>
                <td colSpan={4} style={{ padding:'5px 8px', border:'0.5px solid #ccc', fontWeight:600, color:'#5B21B6' }}>Total {data.nombre}</td>
                <td style={{ padding:'5px 8px', border:'0.5px solid #ccc', textAlign:'center', fontWeight:700, color:'#5B21B6' }}>{data.totalHoras.toFixed(1)}h</td>
                <td style={{ padding:'5px 8px', border:'0.5px solid #ccc' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      ))}

      {/* Total general */}
      <div style={{ marginTop:'20px', padding:'12px 16px', background:'#3E5C76', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', color:'white' }}>
        <span style={{ fontWeight:600 }}>TOTAL GENERAL — {MESES_ESP[mesSel]} {anioSel}</span>
        <span style={{ fontSize:'18px', fontWeight:700 }}>{totalHoras.toFixed(1)} horas</span>
      </div>

      <p style={{ textAlign:'center', fontSize:'9px', color:'#9CA8B3', marginTop:'16px' }}>
        Alliance Française Portoviejo · Generado el {new Date().toLocaleDateString('es-EC', { day:'2-digit', month:'long', year:'numeric' })}
      </p>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          @page { margin: 1.5cm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  )
}
