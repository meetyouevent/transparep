import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, full_name, subscription_status')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  if (profile.role !== 'editor' && profile.role !== 'admin') {
    if (profile.role === 'writer') redirect('/writer')
    if (profile.role === 'reader') redirect('/reader')
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role="editor" userEmail={profile.email} userName={profile.full_name} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
