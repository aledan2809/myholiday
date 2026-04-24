import type { Metadata } from 'next'
import HotelDetailClient from './HotelDetailClient'

export const metadata: Metadata = {
  title: 'Detalii hotel | My Holiday',
  description: 'Detalii complete hotel: preturi sezoniere, facilitati, locatie, hoteluri similare.',
}

export default function HotelDetailPage() {
  return <HotelDetailClient />
}
