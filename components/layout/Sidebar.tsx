'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  LayoutDashboard,
  PlusCircle,
  Library,
  MessageSquare,
  LogOut,
  User,
  BookMarked,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const WRITER_NAV: NavItem[] = [
  { href: '/writer', label: 'Tableau de bord', icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: '/writer/manuscripts/new', label: 'Nouveau manuscrit', icon: <PlusCircle className="h-4 w-4" /> },
]

const READER_NAV: NavItem[] = [
  { href: '/reader', label: 'Catalogue', icon: <Library className="h-4 w-4" /> },
  { href: '/reader/badges', label: 'Mes badges', icon: <BookMarked className="h-4 w-4" /> },
]

const EDITOR_NAV: NavItem[] = [
  { href: '/editor', label: 'Catalogue', icon: <Library className="h-4 w-4" /> },
  { href: '/editor/messages', label: 'Messages', icon: <MessageSquare className="h-4 w-4" /> },
]

const NAV_MAP: Record<UserRole, NavItem[]> = {
  writer: WRITER_NAV,
  reader: READER_NAV,
  editor: EDITOR_NAV,
  admin: WRITER_NAV,
}

const ROLE_LABELS: Record<UserRole, string> = {
  writer: 'Espace Écrivain',
  reader: 'Espace Lecteur',
  editor: 'Espace Éditeur',
  admin: 'Administration',
}

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  writer: <BookOpen className="h-5 w-5" />,
  reader: <BookOpen className="h-5 w-5" />,
  editor: <Building2 className="h-5 w-5" />,
  admin: <BookOpen className="h-5 w-5" />,
}

interface SidebarProps {
  role: UserRole
  userEmail: string
  userName: string | null
}

export function Sidebar({ role, userEmail, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const navItems = NAV_MAP[role] ?? READER_NAV

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 shrink-0 border-r bg-gray-50 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b">
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="font-bold text-gray-900">ManuscritPro</span>
        </Link>
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          {ROLE_ICONS[role]}
          <span>{ROLE_LABELS[role]}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === item.href || (item.href !== '/writer' && item.href !== '/reader' && item.href !== '/editor' && pathname.startsWith(item.href))
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t space-y-2">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-600"
        >
          <User className="h-4 w-4" />
          <div className="overflow-hidden">
            <div className="font-medium text-gray-900 truncate">{userName ?? userEmail}</div>
            <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
