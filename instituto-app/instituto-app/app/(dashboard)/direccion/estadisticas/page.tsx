import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const NIVELES = ['A1','A2','B1','B2','C1','C2']
const NIVEL_COLOR: Record<string,string> = { A1:'#3E5C76', A2:'#5B8DB8', B1:'#2E7D32', B2:'#4CAF50', C1:'#BC4A3C', C2:'#E57373' }

export default async function EstadisticasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: modulos }     = await supabase.from('modulos').select('id, nivel, estado')
  const { data: estudiantes } = await supabase.from('estudiantes').select('id, modulo_id, retirado, descuento_pct')
  const { data: notas }       = await supabase.from('notas').select('estudiante_id, p_oral, p_escrita, c_oral, c_escrita')
  const { data: asistencias } = await supabase.from('asistencias').select('estudiante_id, asistio')

  const mods = modulos || []
  const ests = estudiantes || []
  const nots = notas || []
  const asis = asistencias || []

  const statsPorNivel = NIVELES.map(nivel => {
    const modsNivel = mods.filter(m => m.nivel === nivel)
    const modIds    = modsNivel.map(m => m.id)
    const estsNivel = ests.filter(e => modIds.includes(e.modulo_id))
    const activos   = estsNivel.filter(e => !e.retirado).length
    const retirados = estsNivel.filter(e => e.retirado).length
    const becados   = estsNivel.filter(e => e.descuento_pct === 100).length

    const estIds = estsNivel.map(e => e.id)
    const notasNivel = nots.filter(n => estIds.includes(n.estudiante_id))
    const completas  = notasNivel.filter(n => n.p_oral !== null && n.p_escrita !== null && n.c_oral !== null && n.c_escrita !== null)
    const aprobados  = completas.filter(n => (n.p_oral! + n.p_escrita! + n.c_oral! + n.c_escrita!) >= 50).length

    const asisNivel = asis.filter(a => estIds.includes(a.estudiante_id))
    const pctAsist  = asisNivel.length > 0 ? Math.round((asisNivel.filter(a => a.asistio).length / asisNivel.length) * 100) : 0
    const pctAprob  = completas.length > 0 ? Math.round((aprobados / completas.length) * 100) : null

    return { nivel, cursos: modsNivel.length, activos, retirados, becados, pctAsist, pctAprob, completas: completas.length }
  }).filter(s => s.cursos > 0)

  const totalEst  = ests.filter(e => !e.retirado).length
  const totalRet  = ests.filter(e => e.retirado).length
  const enCurso   = mods.filter(m => m.estado === 'en_curso').length
  const notasComp = nots.filter(n => n.p_oral !== null && n.p_escrita !== null && n.c_oral !== null && n.c_escrita !== null)
  const aprobTot  = notasComp.filter(n => (n.p_oral! + n.p_escrita! + n.c_oral! + n.c_escrita!) >= 50).length
  const pctAprob  = notasComp.length > 0 ? Math.round((aprobTot / notasComp.length) * 100) : 0
  const pctAsist  = asis.length > 0 ? Math.round((asis.filter(a => a.asistio).length / asis.length) * 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">Estadísticas</h1>
          <p className="text-[#6B8294] text-sm">Panorama general del instituto por nivel</p>
        </div>
        <button onClick={() => (window as any).print()} className="btn-primary">🖨️ Imprimir</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Estudiantes activos', val: totalEst,           color: '#3E5C76' },
          { label: 'Módulos en curso',    val: enCurso,            color: '#1B5E20' },
          { label: '% Aprobación',        val: `${pctAprob}%`,     color: pctAprob >= 70 ? '#1B5E20' : '#BC4A3C' },
          { label: '% Asistencia global', val: `${pctAsist}%`,     color: pctAsist >= 75 ? '#1B5E20' : '#BC4A3C' },
        ].map(m => (
          <div key={m.label} className="card text-center">
            <p style={{ fontSize:'28px', fontWeight:700, color:m.color, margin:0 }}>{m.val}</p>
            <p className="text-xs text-[#9CA8B3] mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <h2 className="font-semibold text-[#3E5C76] mb-4">Desglose por nivel</h2>
      <div className="space-y-4 mb-8">
        {statsPorNivel.map(s => (
          <div key={s.nivel} className="card">
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px', flexWrap:'wrap' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:NIVEL_COLOR[s.nivel]||'#3E5C76', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:700, flexShrink:0 }}>
                {s.nivel}
              </div>
              <div>
                <p style={{ fontWeight:600, fontSize:'15px', color:'#1a1a1a', margin:0 }}>Nivel {s.nivel}</p>
                <p style={{ fontSize:'12px', color:'#9CA8B3', margin:0 }}>{s.cursos} curso{s.cursos !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:'10px' }}>
              <div style={{ background:'#F5F0E8', borderRadius:'8px', padding:'10px', textAlign:'center' }}>
                <p style={{ fontSize:'20px', fontWeight:600, color:'#3E5C76', margin:0 }}>{s.activos}</p>
                <p style={{ fontSize:'11px', color:'#9CA8B3', margin:'2px 0 0' }}>Activos</p>
              </div>
              {s.retirados > 0 && (
                <div style={{ background:'#FEF3C7', borderRadius:'8px', padding:'10px', textAlign:'center' }}>
                  <p style={{ fontSize:'20px', fontWeight:600, color:'#92400E', margin:0 }}>{s.retirados}</p>
                  <p style={{ fontSize:'11px', color:'#9CA8B3', margin:'2px 0 0' }}>Retirados</p>
                </div>
              )}
              {s.becados > 0 && (
                <div style={{ background:'#EDE9FE', borderRadius:'8px', padding:'10px', textAlign:'center' }}>
                  <p style={{ fontSize:'20px', fontWeight:600, color:'#5B21B6', margin:0 }}>{s.becados}</p>
                  <p style={{ fontSize:'11px', color:'#9CA8B3', margin:'2px 0 0' }}>Becados</p>
                </div>
              )}
              <div style={{ background:'#F5F0E8', borderRadius:'8px', padding:'10px', textAlign:'center' }}>
                <p style={{ fontSize:'20px', fontWeight:600, color: s.pctAsist >= 75 ? '#1B5E20' : '#BC4A3C', margin:0 }}>{s.pctAsist}%</p>
                <p style={{ fontSize:'11px', color:'#9CA8B3', margin:'2px 0 0' }}>Asistencia</p>
              </div>
              {s.pctAprob !== null && (
                <div style={{ background:'#F5F0E8', borderRadius:'8px', padding:'10px', textAlign:'center' }}>
                  <p style={{ fontSize:'20px', fontWeight:600, color: s.pctAprob >= 50 ? '#1B5E20' : '#BC4A3C', margin:0 }}>{s.pctAprob}%</p>
                  <p style={{ fontSize:'11px', color:'#9CA8B3', margin:'2px 0 0' }}>Aprobación</p>
                </div>
              )}
            </div>

            <div style={{ marginTop:'10px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#9CA8B3', marginBottom:'3px' }}>
                <span>Asistencia promedio</span>
                <span style={{ color: s.pctAsist >= 75 ? '#1B5E20' : '#BC4A3C', fontWeight:500 }}>{s.pctAsist}%</span>
              </div>
              <div style={{ height:'6px', background:'#E8DFCF', borderRadius:'3px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${s.pctAsist}%`, background: s.pctAsist >= 75 ? '#2E7D32' : '#BC4A3C', borderRadius:'3px' }} />
              </div>
              {s.pctAsist < 75 && s.activos > 0 && <p style={{ fontSize:'10px', color:'#BC4A3C', marginTop:'2px' }}>⚠️ Por debajo del mínimo recomendado (75%)</p>}
            </div>
          </div>
        ))}
      </div>

      {statsPorNivel.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-[#9CA8B3]">No hay datos suficientes para mostrar estadísticas.</p>
          <p className="text-xs text-[#9CA8B3] mt-1">Registra módulos y estudiantes para ver el análisis.</p>
        </div>
      )}

      {totalRet > 0 && (
        <div className="card">
          <h3 className="font-semibold text-[#3E5C76] mb-3 text-sm">Tasa de deserción</h3>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:'200px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#9CA8B3', marginBottom:'3px' }}>
                <span>Estudiantes retirados vs total</span>
                <span style={{ color:'#BC4A3C', fontWeight:500 }}>{Math.round((totalRet/(totalEst+totalRet))*100)}%</span>
              </div>
              <div style={{ height:'8px', background:'#E8DFCF', borderRadius:'4px', overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${(totalRet/(totalEst+totalRet))*100}%`, background:'#BC4A3C', borderRadius:'4px' }} />
              </div>
            </div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:'24px', fontWeight:700, color:'#BC4A3C', margin:0 }}>{totalRet}</p>
              <p style={{ fontSize:'11px', color:'#9CA8B3', margin:0 }}>retirados de {totalEst+totalRet} totales</p>
            </div>
          </div>
        </div>
      )}

      <style>{`@media print { nav, button { display:none !important; } body { background:white !important; } }`}</style>
    </div>
  )
}
