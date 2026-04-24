import type { ReactNode } from 'react'

export default function MyHolidayLayout({ children }: { children: ReactNode }) {
  return (
    <div className="myholiday-fonts">
      {children}
    </div>
  )
}
