'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ro">
      <head>
        <title>Error</title>
      </head>
      <body style={{ fontFamily: 'sans-serif', textAlign: 'center', paddingTop: '4rem' }}>
        <h2>Something went wrong</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  )
}
