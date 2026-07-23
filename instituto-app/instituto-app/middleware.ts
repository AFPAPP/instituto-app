import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Si no está autenticado y está intentando acceder a páginas protegidas
  if (!user && path !== '/' && !path.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Si está autenticado y va al login, redirigir según su rol
  if (user && path === '/') {
    const { data: profesor } = await supabase
      .from('profesores')
      .select('rol')
      .eq('user_id', user.id)
      .single()

    if (profesor?.rol === 'direccion') {
      return NextResponse.redirect(new URL('/direccion', request.url))
    } else {
      return NextResponse.redirect(new URL('/profesor', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
