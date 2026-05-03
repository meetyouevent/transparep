import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!sender_id (id, full_name, email, avatar_url),
      recipient:profiles!recipient_id (id, full_name, email, avatar_url),
      manuscript:manuscripts (id, title)
    `)
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ messages: data })
}

export async function POST(request: Request) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { recipient_id, manuscript_id, subject, content } = body

  if (!recipient_id || !subject?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      recipient_id,
      manuscript_id: manuscript_id ?? null,
      subject: subject.trim(),
      content: content.trim(),
    })
    .select(`
      *,
      sender:profiles!sender_id (id, full_name, email, avatar_url),
      recipient:profiles!recipient_id (id, full_name, email, avatar_url),
      manuscript:manuscripts (id, title)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: data }, { status: 201 })
}
