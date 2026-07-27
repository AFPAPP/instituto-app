'use client'
export default function PrintBtn() {
  return (
    <button
      onClick={() => window.print()}
      style={{ padding:'8px 20px', background:'#3E5C76', color:'white', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:500, cursor:'pointer' }}>
      🖨️ Imprimir / Guardar PDF
    </button>
  )
}
