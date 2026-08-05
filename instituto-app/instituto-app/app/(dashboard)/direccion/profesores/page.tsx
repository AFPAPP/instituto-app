import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ProfesoresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: me } = await supabase.from('profesores').select('rol').eq('user_id', user.id).single()
  if (me?.rol !== 'direccion') redirect('/profesor')

  const { data: profesores } = await supabase
    .from('profesores')
    .select('id, nombre, correo, rol')
    .eq('rol', 'profesor')
    .order('nombre')

  const { data: modulos } = await supabase
    .from('modulos')
    .select('id, nivel, modulo, grupo, estado, profesor_id')
    .in('estado', ['en_curso', 'por_iniciar'])
    .order('nivel')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#3E5C76]">Profesores</h1>
        <p className="text-[#6B8294] text-sm mt-1">Vista de todos los profesores y sus cursos activos</p>
      </div>

      <div className="space-y-4">
        {profesores?.map(prof => {
          const cursosProf = modulos?.filter(m => m.profesor_id === prof.id) || []
          const iniciales = prof.nombre.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

          return (
            <div key={prof.id} className="card">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:'#3E5C76', color:'#FAF3E8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:600, flexShrink:0 }}>
                    {iniciales}
                  </div>
                  <div>
                    <p className="font-semibold text-[#1a1a1a]">{prof.nombre}</p>
                    <p className="text-xs text-[#9CA8B3]">{prof.correo}</p>
                  </div>
                </div>
                <Link href={`/direccion/profesores/${prof.id}`}
                  style={{ padding:'6px 14px', fontSize:'12px', background:'transparent', color:'#3E5C76', border:'1px solid #3E5C76', borderRadius:'8px', textDecoration:'none' }}>
                  Ver cursos →
                </Link>
              </div>

              {cursosProf.length > 0 ? (
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {cursosProf.map(m => (
                    <Link key={m.id} href={`/direccion/profesores/${prof.id}/curso/${m.id}`}
                      style={{ padding:'4px 10px', fontSize:'12px', background:'#F0F4F8', color:'#3E5C76', borderRadius:'8px', textDecoration:'none', border:'0.5px solid #E8DFCF' }}>
                      {m.nivel} — {m.modulo} <span style={{ fontSize:'10px', color:'#9CA8B3' }}>({m.grupo})</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#9CA8B3]">Sin cursos activos actualmente</p>
              )}
            </div>
          )
        })}

        {(!profesores || profesores.length === 0) && (
          <div className="card text-center py-12">
            <p className="text-[#9CA8B3]">No hay profesores registrados.</p>
          </div>
        )}
      </div>
    </div>
  )
}
