export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', paddingTop: '4rem', fontFamily: 'sans-serif' }}>
      <h2>404 — Pagina nu a fost gasita</h2>
      <a href="/my-holiday">Inapoi la pagina principala</a>
    </div>
  )
}
