import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zimy2 - HD Video Meetings',
  description: 'Free HD video meetings for everyone. Better than Zoom and Google Meet.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-white antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
