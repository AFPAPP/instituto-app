'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function MarcarLeidasBtn() {
  const supabase = createClient()
  const router = useRouter()

  async function marcarTodas() {
    await supabase.from('notificaciones').update({ leida: true }).eq('leida', false)
    router.refresh()
  }

  return (
    <button onClick={marcarTodas} className="btn-secondary btn-sm">
      ✓ Marcar todas como leídas
    </button>
  )
}
