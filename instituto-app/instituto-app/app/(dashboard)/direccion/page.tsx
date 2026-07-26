import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DireccionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const [{ count: totalEst }, { count: cursosActivos }, { count: totalProfs }, { data: alertas }] = await Promise.all([
    supabase.from('estudiantes').select('*', { count: 'exact', head: true }),
    supabase.from('modulos').select('*', { count: 'exact', head: true }).eq('estado', 'en_curso'),
    supabase.from('profesores').select('*', { count: 'exact', head: true }).eq('rol', 'profesor'),
    supabase.from('vista_resumen').select('apellido, nombre, porcentaje_asistencia, nivel, modulo').lt('porcentaje_asistencia', 0.75).gt('porcentaje_asistencia', 0),
  ])

  const { data: modulos } = await supabase
    .from('modulos').select('id, nivel, modulo, grupo, estado, profesores(nombre)')
    .in('estado', ['en_curso', 'por_iniciar']).order('estado')

  const metricas = [
    { label: 'Estudiantes activos', val: totalEst || 0,        color: '#3E5C76' },
    { label: 'Cursos en curso',     val: cursosActivos || 0,   color: '#1B5E20' },
    { label: 'Profesores',          val: totalProfs || 0,      color: '#3E5C76' },
    { label: 'Alertas asistencia',  val: alertas?.length || 0, color: alertas && alertas.length > 0 ? '#BC4A3C' : '#1B5E20' },
  ]

  const accesos = [
    { href: '/direccion/modulos',     icon: '📚', label: 'Módulos',     desc: 'Crear y configurar cursos' },
    { href: '/direccion/estudiantes', icon: '👥', label: 'Estudiantes', desc: 'Registrar y gestionar alumnos' },
    { href: '/direccion/resumen',     icon: '📊', label: 'Resumen',     desc: 'Estado financiero por curso' },
    { href: '/direccion/bilan',       icon: '📋', label: 'BILAN',       desc: 'Registro oficial anual' },
    { href: '/direccion/usuarios',    icon: '🔑', label: 'Usuarios',    desc: 'Cuentas de profesores' },
  ]

  return (
    <div>
      <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'24px', fontWeight:500, color:'#3E5C76', marginBottom:'24px' }}>
        Panel de dirección
      </h1>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
        {metricas.map(m => (
          <div key={m.label} style={{ background:'white', borderRadius:'12px', border:'0.5px solid #E8DFCF', padding:'16px', textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
            <p style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'28px', fontWeight:500, color:m.color, margin:0 }}>{m.val}</p>
            <p style={{ fontSize:'12px', color:'#9CA8B3', margin:'4px 0 0', fontFamily:'Inter,sans-serif' }}>{m.label}</p>
          </div>
        ))}
      </div>

      {alertas && alertas.length > 0 && (
        <div style={{ background:'white', borderRadius:'12px', border:'1px solid #BC4A3C', padding:'16px', marginBottom:'24px', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'16px', color:'#BC4A3C', marginBottom:'12px', fontWeight:500 }}>
            ⚠️ Alertas de baja asistencia (&lt;75%)
          </h2>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {alertas.slice(0, 5).map((a, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'13px' }}>
                <span style={{ color:'#1a1a1a', fontFamily:'Inter,sans-serif' }}>{a.apellido}, {a.nombre}</span>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <span style={{ fontSize:'11px', color:'#9CA8B3', fontFamily:'Inter,sans-serif' }}>{a.nivel} {a.modulo}</span>
                  <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:'4px', fontSize:'11px', fontWeight:500, background:'#FEE2E2', color:'#991B1B' }}>
                    {Math.round((a.porcentaje_asistencia || 0) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/direccion/resumen" style={{ fontSize:'12px', color:'#3E5C76', textDecoration:'none', marginTop:'8px', display:'block' }}>
            Ver resumen completo →
          </Link>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'24px' }}>
        {accesos.map(a => (
          <Link key={a.href} href={a.href} style={{ textDecoration:'none' }}>
            <div style={{ background:'white', borderRadius:'12px', border:'0.5px solid #E8DFCF', padding:'16px', display:'flex', alignItems:'center', gap:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize:'22px' }}>{a.icon}</span>
              <div>
                <p style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'14px', fontWeight:500, color:'#3E5C76', margin:0 }}>{a.label}</p>
                <p style={{ fontSize:'11px', color:'#9CA8B3', margin:'2px 0 0', fontFamily:'Inter,sans-serif' }}>{a.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {modulos && modulos.length > 0 && (
        <div>
          <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'16px', color:'#3E5C76', marginBottom:'12px', fontWeight:500 }}>Cursos activos</h2>
          <div style={{ background:'white', borderRadius:'12px', border:'0.5px solid #E8DFCF', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
            {modulos.map((m, i) => (
              <div key={m.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom: i < modulos.length-1 ? '0.5px solid #E8DFCF' : 'none' }}>
                <div>
                  <p style={{ fontSize:'13px', fontWeight:500, color:'#1a1a1a', margin:0, fontFamily:'Inter,sans-serif' }}>
                    {m.nivel} — {m.modulo} <span style={{ color:'#9CA8B3', fontWeight:400 }}>({m.grupo})</span>
                  </p>
                  <p style={{ fontSize:'11px', color:'#9CA8B3', margin:'2px 0 0', fontFamily:'Inter,sans-serif' }}>
                    {(m.profesores as { nombre: string } | null)?.nombre}
                  </p>
                </div>
                <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:'4px', fontSize:'11px', fontWeight:500, background: m.estado === 'en_curso' ? '#D1FAE5' : '#FEF3C7', color: m.estado === 'en_curso' ? '#065F46' : '#92400E' }}>
                  {m.estado === 'en_curso' ? 'En curso' : 'Por iniciar'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
