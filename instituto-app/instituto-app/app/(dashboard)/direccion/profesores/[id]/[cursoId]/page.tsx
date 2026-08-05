import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function CursoProfesorDireccionPage({ params }: { params: Promise<{ id: string; cursoId: string }> }) {
  const { id, cursoId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const { data: prof } = await supabase.from('profesores').select('id, nombre').eq('id', id).single()
  const { data: modulo } = await supabase.from('modulos').select('*').eq('id', cursoId).single()
  if (!modulo) redirect(`/direccion/profesores/${id}`)

  const { data: estudiantes } = await supabase.from('estudiantes').select('id, apellido, nombre').eq('modulo_id', cursoId).eq('retirado', false).order('apellido')
  const { data: sesiones } = await supabase.from('sesiones').select('id, fecha, numero_clase, cancelada').eq('modulo_id', cursoId).order('fecha')

  const hoy = new Date().toISOString().split('T')[0]
  const sesionesPasadas = sesiones?.filter(s => s.fecha <= hoy && !s.cancelada) || []

  const estIds = estudiantes?.map(e => e.id) || []
  const sesIds = sesionesPasadas.map(s => s.id)

  let asisData: {estudiante_id:string; sesion_id:string; asistio:boolean}[] = []
  if (estIds.length > 0 && sesIds.length > 0) {
    const { data } = await supabase.from('asistencias').select('estudiante_id, sesion_id, asistio').in('estudiante_id', estIds).in('sesion_id', sesIds)
    asisData = data || []
  }

  let notasData: {estudiante_id:string; p_oral:number|null; p_escrita:number|null; c_oral:number|null; c_escrita:number|null}[] = []
  if (estIds.length > 0) {
    const { data } = await supabase.from('notas').select('estudiante_id, p_oral, p_escrita, c_oral, c_escrita').in('estudiante_id', estIds)
    notasData = data || []
  }

  const asisMap = new Map<string, Map<string, boolean>>()
  asisData.forEach(a => {
    if (!asisMap.has(a.estudiante_id)) asisMap.set(a.estudiante_id, new Map())
    asisMap.get(a.estudiante_id)!.set(a.sesion_id, a.asistio)
  })

  const notasMap = new Map(notasData.map(n => [n.estudiante_id, n]))

  return (
    <div>
      <div className="mb-1">
        <Link href={`/direccion/profesores/${id}`} className="text-[#9CA8B3] text-sm hover:text-[#3E5C76]">← Volver a {prof?.nombre}</Link>
      </div>

      <div className="flex items-start justify-between mb-6 mt-3 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#3E5C76]">{modulo.nivel} — {modulo.modulo}</h1>
          <p className="text-[#6B8294] text-sm">{modulo.grupo} · Prof: {prof?.nombre}</p>
        </div>
        <Link href={`/direccion/modulos/${cursoId}/imprimir`} className="btn-secondary">🖨️ Imprimir reporte</Link>
      </div>

      {/* Asistencias */}
      <h2 className="font-semibold text-[#3E5C76] mb-3">Asistencias</h2>
      {sesionesPasadas.length === 0 ? (
        <div className="card text-center py-6 mb-6"><p className="text-[#9CA8B3] text-sm">No hay sesiones pasadas.</p></div>
      ) : (
        <div className="card p-0 overflow-hidden mb-6" style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
            <thead>
              <tr>
                <th style={{ background:'#3E5C76', color:'white', padding:'6px 10px', textAlign:'left', minWidth:'140px' }}>Estudiante</th>
                {sesionesPasadas.map(s => (
                  <th key={s.id} style={{ background:'#3E5C76', color:'white', padding:'4px', textAlign:'center', minWidth:'32px', fontSize:'9px' }}>
                    {new Date(s.fecha + 'T12:00:00').getDate()}/{new Date(s.fecha + 'T12:00:00').getMonth()+1}
                  </th>
                ))}
                <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center', minWidth:'45px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {estudiantes?.map((e, i) => {
                const presentes = sesionesPasadas.filter(s => asisMap.get(e.id)?.get(s.id) === true).length
                return (
                  <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#FAF3E8' }}>
                    <td style={{ padding:'6px 10px', fontWeight:500, borderBottom:'0.5px solid #E8DFCF' }}>{e.apellido}, {e.nombre}</td>
                    {sesionesPasadas.map(s => {
                      const val = asisMap.get(e.id)?.get(s.id)
                      return (
                        <td key={s.id} style={{ padding:'3px', textAlign:'center', borderBottom:'0.5px solid #E8DFCF', background: val === true ? '#D1FAE5' : val === false ? '#FEE2E2' : 'white', color: val === true ? '#065F46' : val === false ? '#991B1B' : '#ccc', fontWeight:700, fontSize:'11px' }}>
                          {val === true ? '✓' : val === false ? '✗' : ''}
                        </td>
                      )
                    })}
                    <td style={{ padding:'3px', textAlign:'center', fontWeight:700, borderBottom:'0.5px solid #E8DFCF' }}>{presentes}/{sesionesPasadas.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Notas */}
      <h2 className="font-semibold text-[#3E5C76] mb-3">Notas finales</h2>
      <div className="card p-0 overflow-hidden">
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
          <thead>
            <tr>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px 10px', textAlign:'left', minWidth:'140px' }}>Estudiante</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center' }}>P. Oral</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center' }}>P. Escrita</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center' }}>C. Oral</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center' }}>C. Escrita</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center' }}>Total</th>
              <th style={{ background:'#3E5C76', color:'white', padding:'6px', textAlign:'center' }}>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {estudiantes?.map((e, i) => {
              const n = notasMap.get(e.id)
              const total = n ? (n.p_oral??0)+(n.p_escrita??0)+(n.c_oral??0)+(n.c_escrita??0) : null
              const aprobado = total !== null && total >= 50
              return (
                <tr key={e.id} style={{ background: i % 2 === 0 ? 'white' : '#FAF3E8' }}>
                  <td style={{ padding:'6px 10px', fontWeight:500, borderBottom:'0.5px solid #E8DFCF' }}>{e.apellido}, {e.nombre}</td>
                  <td style={{ padding:'6px', textAlign:'center', borderBottom:'0.5px solid #E8DFCF' }}>{n?.p_oral ?? '—'}</td>
                  <td style={{ padding:'6px', textAlign:'center', borderBottom:'0.5px solid #E8DFCF' }}>{n?.p_escrita ?? '—'}</td>
                  <td style={{ padding:'6px', textAlign:'center', borderBottom:'0.5px solid #E8DFCF' }}>{n?.c_oral ?? '—'}</td>
                  <td style={{ padding:'6px', textAlign:'center', borderBottom:'0.5px solid #E8DFCF' }}>{n?.c_escrita ?? '—'}</td>
                  <td style={{ padding:'6px', textAlign:'center', fontWeight:700, borderBottom:'0.5px solid #E8DFCF' }}>{total ?? '—'}/100</td>
                  <td style={{ padding:'6px', textAlign:'center', fontWeight:700, borderBottom:'0.5px solid #E8DFCF', color: total === null ? '#9CA8B3' : aprobado ? '#065F46' : '#991B1B', background: total === null ? 'white' : aprobado ? '#D1FAE5' : '#FEE2E2' }}>
                    {total === null ? '—' : aprobado ? 'Aprobado' : 'Reprobado'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#9CA8B3] mt-2 text-center">Para editar asistencias o notas usa la sección correspondiente en el menú</p>
    </div>
  )
}
