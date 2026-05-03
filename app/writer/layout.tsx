import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function WriterLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'writer') {
    // Redirect to correct dashboard
    if (profile?.role === 'reader') redirect('/reader')
    if (profile?.role === 'editor') redirect('/editor')
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role="writer" userEmail={profile.email} userName={profile.full_name} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
