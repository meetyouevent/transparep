import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function ReaderLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, email, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  // Writers and editors can also browse, but use their own dashboards primarily
  if (profile.role === 'writer') redirect('/writer')
  if (profile.role === 'editor') redirect('/editor')

  return (
    <div className="flex min-h-screen">
      <Sidebar role="reader" userEmail={profile.email} userName={profile.full_name} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
