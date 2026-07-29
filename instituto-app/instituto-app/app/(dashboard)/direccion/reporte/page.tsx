import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const NIVELES = ['A1','A2','B1','B2','C1','C2']

const HORAS_NIVEL: Record<string, number> = {
  'A1': 120, 'A2': 200, 'B1': 240, 'B2': 270, 'C1': 300, 'C2': 300
}

const PRECIO_HORA = 5

export default async function ReportePage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { anio: anioParam } = await searchParams
  const anio = parseInt(anioParam || new Date().getFullYear().toString())

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const inicioAnio = `${anio}-01-01`
  const finAnio    = `${anio}-12-31`

  const { data: modulos } = await supabase
    .from('modulos')
    .select('id, nivel, modalidad, tipo_grupo, horas_sesion')
    .gte('fecha_inicio', inicioAnio)
    .lte('fecha_inicio', finAnio)

  const moduloIds = modulos?.map(m => m.id) || []

  const { data: estudiantes } = moduloIds.length > 0
    ? await supabase.from('estudiantes').select('id, modulo_id, categoria_edad, tipo_inscripcion, retirado').in('modulo_id', moduloIds)
    : { data: [] }

  const { data: sesiones } = moduloIds.length > 0
    ? await supabase.from('sesiones').select('id, modulo_id').in('modulo_id', moduloIds).eq('cancelada', false)
    : { data: [] }

  const horasMap = new Map(modulos?.map(m => [m.id, m.horas_sesion]) || [])
  const nivelMap = new Map(modulos?.map(m => [m.id, m.nivel]) || [])
  const modalidadMap = new Map(modulos?.map(m => [m.id, m.modalidad]) || [])

  const ests = estudiantes || []
  const sess = sesiones || []

  // Totales generales
  const totalInscripciones = ests.length
  const primeraVez  = ests.filter(e => e.tipo_inscripcion === 'primera_vez' || !e.tipo_inscripcion)
  const recurrentes = ests.filter(e => e.tipo_inscripcion === 'recurrente')
  const totalApprenants = primeraVez.length

  // Por categoría de edad
  const adultos      = ests.filter(e => e.categoria_edad === 'adulto' || !e.categoria_edad)
  const adolescentes = ests.filter(e => e.categoria_edad === 'adolescente')
  const ninos        = ests.filter(e => e.categoria_edad === 'nino')

  // Horas vendidas
  let totalHorasVendidas = 0
  const horasPorNivel: Record<string, number> = {}
  const inscPorNivel: Record<string, number> = {}
  const primeraVezPorNivel: Record<string, number> = {}
  const recurrentesPorNivel: Record<string, number> = {}

  NIVELES.forEach(n => {
    horasPorNivel[n] = 0
    inscPorNivel[n] = 0
    primeraVezPorNivel[n] = 0
    recurrentesPorNivel[n] = 0
  })

  for (const ses of sess) {
    const hSes = horasMap.get(ses.modulo_id) || 0
    const estsEnMod = ests.filter(e => e.modulo_id === ses.modulo_id)
    const hVendidas = hSes * estsEnMod.length
    totalHorasVendidas += hVendidas
    const nivel = nivelMap.get(ses.modulo_id) || ''
    if (nivel && horasPorNivel[nivel] !== undefined) {
      horasPorNivel[nivel] += hVendidas
    }
  }

  for (const est of ests) {
    const nivel = nivelMap.get(est.modulo_id) || ''
    if (nivel) {
      inscPorNivel[nivel] = (inscPorNivel[nivel] || 0) + 1
      if (est.tipo_inscripcion === 'recurrente') {
        recurrentesPorNivel[nivel] = (recurrentesPorNivel[nivel] || 0) + 1
      } else {
        primeraVezPorNivel[nivel] = (primeraVezPorNivel[nivel] || 0) + 1
      }
    }
  }

  // Virtual
  const modVirtualIds = modulos?.filter(m => m.modalidad === 'Virtual').map(m => m.id) || []
  const estsVirtual = ests.filter(e => modVirtualIds.includes(e.modulo_id))
  const sesVirtual = sess.filter(s => modVirtualIds.includes(s.modulo_id))
  let horasVirtual = 0
  for (const ses of sesVirtual) {
    const hSes = horasMap.get(ses.modulo_id) || 0
    const estsEnMod = ests.filter(e => e.modulo_id === ses.modulo_id)
    horasVirtual += hSes * estsEnMod.length
  }

  const recettesEnsenanza = totalHorasVendidas * PRECIO_HORA
  const tarifaHoraEUR = (PRECIO_HORA * 0.92).toFixed(2)
  const anios = [2024, 2025, 2026, 2027]

  function Fila({ num, label, valor, unidad = '', destacado = false, sub = false }: { num: string; label: string; valor: string | number; unidad?: string; destacado?: boolean; sub?: boolean }) {
    return (
      <div style={{ display:'flex', alignItems:'flex-start', gap:'12px', padding:'10px 0', borderBottom:'0.5px solid #E8DFCF', background: destacado ? '#F5F0E8' : 'transparent', paddingLeft: sub ? '16px' : '0' }}>
        <span style={{ fontSize:'11px', fontWeight:600, color:'#BC4A3C', minWidth:'40px', flexShrink:0, paddingTop:'2px' }}>{num}</span>
        <span style={{ fontSize:'12px', color: sub ? '#9CA8B3' : '#6B8294', flex:1 }}>{label}</span>
        <span style={{ fontSize:'14px', fontWeight:600, color:'#1E3A5F', minWidth:'120px', textAlign:'right' }}>
          {valor} <span style={{ fontSize:'11px', fontWeight:400, color:'#9CA8B3' }}>{unidad}</span>
        </span>
      </div>
    )
  }

  function SeccionTitulo({ num, label }: { num: string; label: string }) {
    return (
      <div style={{ background:'#1E3A5F', color:'white', padding:'10px 16px', borderRadius:'8px', margin:'20px 0 8px', display:'flex', alignItems:'center', gap:'10px' }}>
        <span style={{ fontSize:'13px', fontWeight:700 }}>{num}</span>
        <span style={{ fontSize:'13px', fontWeight:600 }}>{label}</span>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">Reporte Anual {anio}</h1>
          <p className="text-[#6B8294] text-sm mt-1">Datos para el cuestionario oficial de la Alliance Française</p>
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          {anios.map(a => (
            <a key={a} href={`/direccion/reporte?anio=${a}`}
              style={{ padding:'6px 14px', borderRadius:'8px', fontSize:'13px', textDecoration:'none', border:'1px solid', background: a === anio ? '#1E3A5F' : 'white', color: a === anio ? 'white' : '#6B8294', borderColor: a === anio ? '#1E3A5F' : '#E8DFCF' }}>
              {a}
            </a>
          ))}
        </div>
      </div>

      <div style={{ background:'#E8F4FD', border:'1px solid #BFD9EF', borderRadius:'10px', padding:'12px 16px', marginBottom:'20px', fontSize:'12px', color:'#1E3A5F' }}>
        ℹ️ Módulos con <b>fecha de inicio en {anio}</b>. Precio estándar: <b>${PRECIO_HORA}/hora</b>.
        Las horas incluyen todas las sesiones del módulo completo aunque terminen en {anio+1}.
      </div>

      {/* PUNTO 2 */}
      <SeccionTitulo num="2" label="Activité d'enseignement — Cours de français grand public" />
      <div className="card">
        <Fila num="2.2" label="Nombre total d'apprenants différents (inscrits pour la première fois)" valor={totalApprenants} unidad="apprenants" destacado />
        <Fila num="" label="↳ Inscrits récurrents (déjà étudiants avant)" valor={recurrentes.length} unidad="apprenants" sub />
        <Fila num="" label="↳ Total inscriptions (première fois + récurrents)" valor={totalInscripciones} unidad="inscriptions" sub />
        <Fila num="2.7" label="...français langue seconde" valor={totalApprenants} unidad="apprenants" />
        <Fila num="2.9" label="Nombre total d'heures-vendues" valor={totalHorasVendidas.toLocaleString()} unidad="heures" destacado />
        <Fila num="2.10" label="Heures dispensées en cours particuliers" valor={0} unidad="heures" />
        <Fila num="2.11" label="Nombre total d'inscriptions" valor={totalInscripciones} unidad="inscriptions" />
      </div>

      {/* PUNTO 3 */}
      <SeccionTitulo num="3" label="Répartition des cours de français" />
      <div className="card">
        <Fila num="3.4" label="L'Alliance propose-t-elle des cours en ligne ?" valor="Oui (Virtual)" />
        <Fila num="3.8" label="Nombre d'apprenants en cours entièrement en ligne" valor={new Set(estsVirtual.map(e=>e.id)).size} unidad="apprenants" />
        <Fila num="3.9" label="Nombre d'heures vendues en cours entièrement en ligne" valor={horasVirtual} unidad="heures" />
        <div style={{ height:'8px' }} />
        <Fila num="3.13" label="Tarif horaire (en euro) — cours collectif adulte A1" valor={tarifaHoraEUR} unidad="EUR" destacado />
        <div style={{ height:'8px' }} />
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'8px 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Heures par niveau CECRL</p>
        {NIVELES.map((n, i) => <Fila key={n} num={`3.${14+i}`} label={`${n}`} valor={HORAS_NIVEL[n]} unidad="heures" />)}
        <div style={{ height:'8px' }} />
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'8px 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Inscriptions par niveau</p>
        {NIVELES.map((n, i) => (
          <div key={n}>
            <Fila num={`3.${20+i}`} label={`Inscriptions ${n} (total)`} valor={inscPorNivel[n] || 0} unidad="inscriptions" />
            <Fila num="" label={`↳ Première fois ${n}`} valor={primeraVezPorNivel[n] || 0} unidad="" sub />
            <Fila num="" label={`↳ Récurrents ${n}`} valor={recurrentesPorNivel[n] || 0} unidad="" sub />
          </div>
        ))}
        <div style={{ height:'8px' }} />
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'8px 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Heures vendues par niveau</p>
        {NIVELES.map((n, i) => <Fila key={n} num={`3.${26+i}`} label={`Heures vendues ${n}`} valor={Math.round(horasPorNivel[n] || 0)} unidad="heures" />)}
      </div>

      {/* PUNTO 5 */}
      <SeccionTitulo num="5" label="Connaissance client — Profil des apprenants" />
      <div className="card">
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Adultes</p>
        <Fila num="5.2" label="Nombre d'apprenants adultes (18 ans et plus)" valor={new Set(adultos.map(e=>e.id)).size} unidad="apprenants" />
        <Fila num="5.3" label="Parmi les adultes, moins de 60 ans" valor={new Set(adultos.map(e=>e.id)).size} unidad="apprenants" />
        <Fila num="5.4" label="Parmi les adultes, séniors (plus de 60 ans)" valor={0} unidad="apprenants" />
        <div style={{ height:'8px' }} />
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'8px 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Adolescents</p>
        <Fila num="5.6" label="Nombre d'apprenants adolescents (12 à 17 ans)" valor={new Set(adolescentes.map(e=>e.id)).size} unidad="apprenants" />
        <div style={{ height:'8px' }} />
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'8px 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Enfants</p>
        <Fila num="5.8" label="Nombre d'apprenants enfants (0 à 11 ans)" valor={new Set(ninos.map(e=>e.id)).size} unidad="apprenants" />
        <Fila num="5.9" label="Entre 6 et 11 ans" valor={new Set(ninos.map(e=>e.id)).size} unidad="apprenants" />
        <Fila num="5.10" label="Moins de 6 ans" valor={0} unidad="apprenants" />
      </div>

      {/* PUNTO 8 */}
      <SeccionTitulo num="8.2" label="Bilan financier — Recettes de l'enseignement du français" />
      <div className="card">
        <Fila num="8.2" label={`${totalHorasVendidas} h × $${PRECIO_HORA}/h`} valor={`$${recettesEnsenanza.toLocaleString()}`} unidad="USD" destacado />
        <p style={{ fontSize:'11px', color:'#9CA8B3', marginTop:'8px' }}>
          Equivalente aproximado en EUR: €{(recettesEnsenanza * 0.92).toLocaleString('es-EC', { maximumFractionDigits:2 })} (tasa referencial 0.92)
        </p>
      </div>

      <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:'10px', padding:'12px 16px', marginTop:'20px', fontSize:'12px', color:'#92400E' }}>
        ⚠️ Verifique los datos antes de ingresar al formulario oficial. Los puntos 5.12-5.23 (distribución por edad y nivel) requieren datos adicionales no disponibles en el sistema.
      </div>

      <style>{`@media print { nav, a[href], button { display:none !important; } body { background:white !important; } }`}</style>
    </div>
  )
}
