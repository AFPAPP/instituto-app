'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

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
    { href: '/profesor', label: 'Mis cursos' },
  ]
  const linksDireccion = [
    { href: '/direccion',             label: 'Panel' },
    { href: '/direccion/modulos',     label: 'Módulos' },
    { href: '/direccion/estudiantes', label: 'Estudiantes' },
    { href: '/direccion/resumen',     label: 'Resumen' },
    { href: '/direccion/bilan',       label: 'BILAN' },
    { href: '/direccion/usuarios',    label: 'Usuarios' },
  ]
  const links = rol === 'direccion' ? linksDireccion : linksProfesor

  return (
    <nav style={{ backgroundColor:'#FAF3E8', borderBottom:'0.5px solid #E8DFCF', position:'sticky', top:0, zIndex:50, colorScheme:'light' }}>
      <div className="tricolor-stripe" />
      <div style={{ maxWidth:'1152px', margin:'0 auto', padding:'0 16px', height:'58px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
          <Link href={rol === 'direccion' ? '/direccion' : '/profesor'} style={{ display:'flex', alignItems:'center', gap:'10px', textDecoration:'none' }}>
            <Image src="/logo-afp.png" alt="Alliance Française Portoviejo" width={36} height={36} style={{ objectFit:'contain' }} />
            <div>
              <div style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:'14px', fontWeight:500, color:'#3E5C76', lineHeight:1.2 }}>
                Alliance Française
              </div>
              <div style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:'10px', color:'#BC4A3C', fontStyle:'italic' }}>
                Portoviejo
              </div>
            </div>
          </Link>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'2px', overflowX:'auto' }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} style={{
              padding:'6px 12px', borderRadius:'8px', fontSize:'13px',
              whiteSpace:'nowrap', textDecoration:'none', fontFamily:'Inter,sans-serif',
              fontWeight: path === l.href ? 500 : 400,
              backgroundColor: path === l.href ? '#3E5C76' : 'transparent',
              color: path === l.href ? '#FAF3E8' : '#6B8294',
              transition:'all 0.15s',
            }}>
              {l.label}
            </Link>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#3E5C76', color:'#FAF3E8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:500, fontFamily:'Inter,sans-serif' }}>
            {iniciales}
          </div>
          <button onClick={logout} style={{ fontSize:'12px', color:'#9CA8B3', background:'none', border:'none', cursor:'pointer', fontFamily:'Inter,sans-serif' }}>
            Salir
          </button>
        </div>
      </div>
    </nav>
  )
}
