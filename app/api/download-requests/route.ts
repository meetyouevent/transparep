import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'editor') {
    return NextResponse.json({ error: 'Réservé aux éditeurs' }, { status: 403 })
  }

  const { manuscript_id, message } = await request.json()

  if (!manuscript_id) {
    return NextResponse.json({ error: 'manuscript_id requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('download_requests')
    .insert({
      editor_id: user.id,
      manuscript_id,
      message: message?.trim() ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Vous avez déjà envoyé une demande pour ce manuscrit' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ request: data }, { status: 201 })
}

export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('download_requests')
    .select(`
      *,
      editor:profiles!editor_id (id, full_name, email),
      manuscript:manuscripts (id, title)
    `)
    .or(`editor_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requests: data })
}
