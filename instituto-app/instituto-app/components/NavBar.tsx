'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface NavBarProps {
  nombre: string
  rol: 'profesor' | 'direccion'
}

export default function NavBar({ nombre, rol }: NavBarProps) {
  const supabase = createClient()
  const router   = useRouter()
  const path     = usePathname()
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    if (rol !== 'direccion') return
    supabase.from('notificaciones').select('id', { count: 'exact', head: true }).eq('leida', false).then(({ count }) => setNotifCount(count || 0))
  }, [rol, path])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const iniciales = nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const linksProfesor = [{ href: '/profesor', label: 'Mis cursos' }]
  const linksDireccion = [
    { href: '/direccion',               label: 'Panel' },
    { href: '/direccion/modulos',       label: 'Módulos' },
    { href: '/direccion/estudiantes',   label: 'Estudiantes' },
    { href: '/direccion/resumen',       label: 'Resumen' },
    { href: '/direccion/bilan',         label: 'BILAN' },
    { href: '/direccion/feriados',      label: 'Feriados' },
    { href: '/direccion/reemplazos',    label: 'Reemplazos' },
    { href: '/direccion/estadisticas',  label: 'Estadísticas' },
     { href: '/direccion/inscripciones', label: 'Inscripciones' },
    { href: '/direccion/usuarios',      label: 'Usuarios' },
  ]
  const links = rol === 'direccion' ? linksDireccion : linksProfesor

  return (
    <nav className="bg-[#FAF3E8] border-b border-[#E8DFCF] sticky top-0 z-50">
      <div className="tricolor-stripe" />
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href={rol === 'direccion' ? '/direccion' : '/profesor'} className="flex items-center gap-2 shrink-0" style={{ textDecoration:'none' }}>
          <div className="w-8 h-8 rounded-full bg-[#3E5C76] text-[#FAF3E8] flex items-center justify-center text-xs font-bold shrink-0">AFP</div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-[#3E5C76] leading-tight">Alliance Française</p>
            <p className="text-xs text-[#BC4A3C] italic leading-tight">Portoviejo</p>
          </div>
        </Link>

        <div className="flex items-center gap-1 overflow-x-auto">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                path === l.href ? 'bg-[#3E5C76] text-[#FAF3E8]' : 'text-[#6B8294] hover:text-[#3E5C76] hover:bg-[#E8EAF6]'
              }`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {rol === 'direccion' && (
            <Link href="/direccion/notificaciones" style={{ position:'relative', textDecoration:'none' }}>
              <div style={{ width:'32px', height:'32px', borderRadius:'50%', background: notifCount > 0 ? '#FEF3C7' : '#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', cursor:'pointer', border: notifCount > 0 ? '1.5px solid #D97706' : '1.5px solid #E8DFCF' }}>
                🔔
              </div>
              {notifCount > 0 && (
                <div style={{ position:'absolute', top:'-4px', right:'-4px', width:'18px', height:'18px', borderRadius:'50%', background:'#BC4A3C', color:'white', fontSize:'10px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </div>
              )}
            </Link>
          )}
          <div className="w-8 h-8 rounded-full bg-[#3E5C76] text-[#FAF3E8] flex items-center justify-center text-xs font-semibold">{iniciales}</div>
          <button onClick={logout} className="text-xs text-[#9CA8B3] hover:text-[#BC4A3C] transition-colors hidden sm:block">Salir</button>
        </div>
      </div>
    </nav>
  )
}
