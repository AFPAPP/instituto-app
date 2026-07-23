'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

interface NavBarProps {
  nombre: string
  rol: 'profesor' | 'direccion'
}

export default function NavBar({ nombre, rol }: NavBarProps) {
  const supabase = createClient()
  const router   = useRouter()
  const path     = usePathname()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const iniciales = nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const linksProfesor = [
    { href: '/profesor',    label: 'Mis cursos' },
  ]
  const linksDireccion = [
    { href: '/direccion',               label: 'Panel' },
    { href: '/direccion/modulos',       label: 'Módulos' },
    { href: '/direccion/estudiantes',   label: 'Estudiantes' },
    { href: '/direccion/resumen',       label: 'Resumen' },
    { href: '/direccion/bilan',         label: 'BILAN' },
    { href: '/direccion/usuarios',      label: 'Usuarios' },
  ]
  const links = rol === 'direccion' ? linksDireccion : linksProfesor

  return (
    <nav className="bg-[#FAF3E8] border-b border-[#E8DFCF] sticky top-0 z-50">
      <div className="tricolor-stripe" />
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={rol === 'direccion' ? '/direccion' : '/profesor'} className="text-[#3E5C76] font-bold text-sm hidden sm:block">AFP Portoviejo</Link>
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
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-[#3E5C76] text-[#FAF3E8] flex items-center justify-center text-xs font-semibold">{iniciales}</div>
          <button onClick={logout} className="text-xs text-[#9CA8B3] hover:text-[#BC4A3C] transition-colors hidden sm:block">Salir</button>
        </div>
      </div>
    </nav>
  )
}
