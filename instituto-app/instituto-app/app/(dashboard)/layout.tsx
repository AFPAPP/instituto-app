import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profesor } = await supabase
    .from('profesores')
    .select('nombre, rol')
    .eq('user_id', user.id)
    .single()

  if (!profesor) redirect('/')

  return (
    <div className="min-h-screen bg-[#FAF3E8]">
      <NavBar nombre={profesor.nombre} rol={profesor.rol} />
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
