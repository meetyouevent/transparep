import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ManuscritPro — Plateforme de critique de manuscrits',
  description:
    'Soumettez vos manuscrits, obtenez des critiques constructives, bénéficiez d\'une pré-lecture IA et connectez-vous avec des éditeurs.',
  keywords: ['manuscrit', 'écriture', 'critique littéraire', 'éditeur', 'roman'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
