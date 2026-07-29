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

  // Módulos que iniciaron en el año seleccionado
  const { data: modulos } = await supabase
    .from('modulos')
    .select('id, nivel, modalidad, tipo_grupo')
    .gte('fecha_inicio', inicioAnio)
    .lte('fecha_inicio', finAnio)

  const moduloIds = modulos?.map(m => m.id) || []

  // Estudiantes de esos módulos
  const { data: estudiantes } = moduloIds.length > 0
    ? await supabase.from('estudiantes').select('id, modulo_id, categoria_edad, retirado').in('modulo_id', moduloIds)
    : { data: [] }

  // Sesiones de esos módulos
  const { data: sesiones } = moduloIds.length > 0
    ? await supabase.from('sesiones').select('id, modulo_id').in('modulo_id', moduloIds).eq('cancelada', false)
    : { data: [] }

  // Horas por sesión de cada módulo
  const { data: modulosHoras } = await supabase.from('modulos').select('id, horas_sesion, nivel, modalidad, tipo_grupo').in('id', moduloIds)
  const horasMap = new Map(modulosHoras?.map(m => [m.id, m.horas_sesion]) || [])
  const nivelMap = new Map(modulosHoras?.map(m => [m.id, m.nivel]) || [])
  const modalidadMap = new Map(modulosHoras?.map(m => [m.id, m.modalidad]) || [])

  const ests = estudiantes || []
  const sess = sesiones || []

  // Estudiantes únicos
  const estUnicosIds = new Set(ests.map(e => e.id))
  const totalEst = estUnicosIds.size

  // Por categoría de edad
  const adultos      = ests.filter(e => e.categoria_edad === 'adulto' || !e.categoria_edad)
  const adolescentes = ests.filter(e => e.categoria_edad === 'adolescente')
  const ninos        = ests.filter(e => e.categoria_edad === 'nino')
  const ninosGrandes = ninos // 6-11 años (no tenemos subdivisión)

  // Horas vendidas total (sesiones × horas × estudiantes por módulo)
  let totalHorasVendidas = 0
  const horasPorNivel: Record<string, number> = {}
  const estPorNivel: Record<string, Set<string>> = {}
  const inscPorNivel: Record<string, number> = {}

  NIVELES.forEach(n => {
    horasPorNivel[n] = 0
    estPorNivel[n] = new Set()
    inscPorNivel[n] = 0
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

  // Inscripciones y estudiantes por nivel
  for (const est of ests) {
    const nivel = nivelMap.get(est.modulo_id) || ''
    if (nivel && estPorNivel[nivel]) {
      estPorNivel[nivel].add(est.id)
      inscPorNivel[nivel] = (inscPorNivel[nivel] || 0) + 1
    }
  }

  // Modalidad virtual
  const modulosVirtuales = modulos?.filter(m => m.modalidad === 'Virtual') || []
  const modVirtualIds = modulosVirtuales.map(m => m.id)
  const estsVirtual = ests.filter(e => modVirtualIds.includes(e.modulo_id))
  const sesVirtual = sess.filter(s => modVirtualIds.includes(s.modulo_id))
  let horasVirtual = 0
  for (const ses of sesVirtual) {
    const hSes = horasMap.get(ses.modulo_id) || 0
    const estsEnMod = ests.filter(e => e.modulo_id === ses.modulo_id)
    horasVirtual += hSes * estsEnMod.length
  }

  // Total inscripciones
  const totalInscripciones = ests.length

  // Recettes enseignement (horas vendidas × $5)
  const recettesEnsenanza = totalHorasVendidas * PRECIO_HORA

  // Tarifa horaria en EUR (aproximado, tasa ~0.92)
  const tarifaHoraEUR = (PRECIO_HORA * 0.92).toFixed(2)

  function Fila({ num, label, valor, unidad = '', destacado = false }: { num: string; label: string; valor: string | number; unidad?: string; destacado?: boolean }) {
    return (
      <div style={{ display:'flex', alignItems:'flex-start', gap:'12px', padding:'10px 0', borderBottom:'0.5px solid #E8DFCF', background: destacado ? '#F5F0E8' : 'transparent' }}>
        <span style={{ fontSize:'11px', fontWeight:600, color:'#BC4A3C', minWidth:'40px', flexShrink:0, paddingTop:'2px' }}>{num}</span>
        <span style={{ fontSize:'12px', color:'#6B8294', flex:1 }}>{label}</span>
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

  const anios = [2024, 2025, 2026, 2027]

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">Reporte Anual</h1>
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
        ℹ️ Este reporte considera todos los módulos con <b>fecha de inicio en {anio}</b>. Las horas incluyen todas las sesiones del módulo aunque terminen en {anio+1}. Precio estándar para cálculo: <b>${PRECIO_HORA}/hora</b>.
      </div>

      {/* PUNTO 2 */}
      <SeccionTitulo num="2" label="Activité d'enseignement — Cours de français grand public" />
      <div className="card">
        <Fila num="2.2" label="Nombre total d'apprenants différents en cours de français" valor={totalEst} unidad="apprenants" />
        <Fila num="2.7" label="...français langue seconde" valor={totalEst} unidad="apprenants" />
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
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'8px 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Heures par niveau CECRL (adultos)</p>
        <Fila num="3.14" label="A1" valor={HORAS_NIVEL['A1']} unidad="heures" />
        <Fila num="3.15" label="A2" valor={HORAS_NIVEL['A2']} unidad="heures" />
        <Fila num="3.16" label="B1" valor={HORAS_NIVEL['B1']} unidad="heures" />
        <Fila num="3.17" label="B2" valor={HORAS_NIVEL['B2']} unidad="heures" />
        <Fila num="3.18" label="C1" valor={HORAS_NIVEL['C1']} unidad="heures" />
        <Fila num="3.19" label="C2" valor={HORAS_NIVEL['C2']} unidad="heures" />
        <div style={{ height:'8px' }} />
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'8px 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Inscriptions par niveau</p>
        {NIVELES.map((n, i) => <Fila key={n} num={`3.${20+i}`} label={`Inscriptions ${n}`} valor={inscPorNivel[n] || 0} unidad="inscriptions" />)}
        <div style={{ height:'8px' }} />
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'8px 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Heures vendues par niveau</p>
        {NIVELES.map((n, i) => <Fila key={n} num={`3.${26+i}`} label={`Heures vendues ${n}`} valor={Math.round(horasPorNivel[n] || 0)} unidad="heures" />)}
      </div>

      {/* PUNTO 5 */}
      <SeccionTitulo num="5" label="Connaissance client — Profil des apprenants" />
      <div className="card">
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Adultes</p>
        <Fila num="5.2" label="Nombre d'apprenants adultes (18 ans et plus)" valor={new Set(adultos.map(e=>e.id)).size} unidad="apprenants" />
        <Fila num="5.3" label="Parmi les adultes, combien ont moins de 60 ans" valor={new Set(adultos.map(e=>e.id)).size} unidad="apprenants" />
        <Fila num="5.4" label="Parmi les adultes, combien sont séniors (plus de 60 ans)" valor={0} unidad="apprenants" />
        <div style={{ height:'8px' }} />
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'8px 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Adolescents</p>
        <Fila num="5.6" label="Nombre d'apprenants adolescents (12 à 17 ans)" valor={new Set(adolescentes.map(e=>e.id)).size} unidad="apprenants" />
        <div style={{ height:'8px' }} />
        <p style={{ fontSize:'11px', fontWeight:600, color:'#6B8294', margin:'8px 0 4px', textTransform:'uppercase', letterSpacing:'0.05em' }}>Enfants</p>
        <Fila num="5.8" label="Nombre d'apprenants enfants (0 à 11 ans)" valor={new Set(ninos.map(e=>e.id)).size} unidad="apprenants" />
        <Fila num="5.9" label="Parmi les enfants, combien ont entre 6 et 11 ans" valor={new Set(ninosGrandes.map(e=>e.id)).size} unidad="apprenants" />
        <Fila num="5.10" label="Parmi les enfants, combien ont moins de 6 ans" valor={0} unidad="apprenants" />
      </div>

      {/* PUNTO 8 */}
      <SeccionTitulo num="8.2" label="Bilan financier — Recettes issues de l'enseignement du français" />
      <div className="card">
        <Fila num="8.2" label={`Recettes issues de l'enseignement du français (${totalHorasVendidas} h × $${PRECIO_HORA}/h)`} valor={`$${recettesEnsenanza.toLocaleString()}`} unidad="USD" destacado />
        <p style={{ fontSize:'11px', color:'#9CA8B3', marginTop:'8px' }}>
          Equivalente aproximado en EUR: €{(recettesEnsenanza * 0.92).toLocaleString('es-EC', { maximumFractionDigits:2 })} (tasa referencial 0.92)
        </p>
      </div>

      <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:'10px', padding:'12px 16px', marginTop:'20px', fontSize:'12px', color:'#92400E' }}>
        ⚠️ Los campos marcados en amarillo requieren verificación manual antes de ingresar al formulario oficial.
        Los puntos 2.3, 2.4, 2.5, 2.6, 2.8 y las distribuciones por edad y nivel (5.12-5.23) requieren datos adicionales no disponibles en el sistema.
      </div>

      <style>{`@media print { nav, a[href], button { display:none !important; } body { background:white !important; } }`}</style>
    </div>
  )
}
