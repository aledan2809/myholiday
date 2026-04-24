'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ro">
      <body style={{ fontFamily: 'sans-serif', textAlign: 'center', paddingTop: '4rem' }}>
        <h2>Something went wrong</h2>
        {error.digest && (
          <p style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>
            Error ID: {error.digest}
          </p>
        )}
        <button onClick={() => reset()} style={{ marginTop: '1.5rem', padding: '0.5rem 1.5rem', cursor: 'pointer' }}>
          Try again
        </button>
      </body>
    </html>
  )
}
