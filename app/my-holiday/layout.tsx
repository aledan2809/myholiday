import type { ReactNode } from 'react'
import { Newsreader, Space_Grotesk } from 'next/font/google'

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-news',
  display: 'swap',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
})

export default function MyHolidayLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${newsreader.variable} ${spaceGrotesk.variable}`}>
      {children}
    </div>
  )
}
