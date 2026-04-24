import type { Metadata } from 'next'
import { Suspense } from 'react'
import HotelsClient from './HotelsClient'

export const metadata: Metadata = {
  title: 'Hoteluri | My Holiday',
  description: 'Exploreaza 210+ hoteluri din 27 orase pe 4 continente. Filtre avansate, preturi sezoniere, anulare gratuita.',
}

export default function HotelsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '48px 24px', textAlign: 'center' }}>Se incarca...</div>}>
      <HotelsClient />
    </Suspense>
  )
}
