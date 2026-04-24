import { NextRequest, NextResponse } from 'next/server'
import { checkKiwiBooking } from '@/lib/kiwiService'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    )
  }
  const { bookingToken, adults } = body as { bookingToken?: string; adults?: number }

  if (!bookingToken) {
    return NextResponse.json(
      { error: 'Missing bookingToken parameter' },
      { status: 400 },
    )
  }

  if (bookingToken.length > 2048) {
    return NextResponse.json(
      { error: 'bookingToken exceeds maximum length (2048 characters)' },
      { status: 400 },
    )
  }

  if (!/^[A-Za-z0-9_\-=.+/]+$/.test(bookingToken)) {
    return NextResponse.json(
      { error: 'bookingToken contains invalid characters' },
      { status: 400 },
    )
  }

  if (adults !== undefined && (adults < 1 || adults > 9 || !Number.isInteger(adults))) {
    return NextResponse.json(
      { error: 'adults must be an integer between 1 and 9' },
      { status: 400 },
    )
  }

  if (!process.env.KIWI_API_KEY) {
    return NextResponse.json(
      { error: 'KIWI_API_KEY is not configured', available: false },
      { status: 503 },
    )
  }

  const result = await checkKiwiBooking(bookingToken, adults || 1)

  return NextResponse.json({
    ...result,
    source: 'kiwi-tequila',
  })
}
