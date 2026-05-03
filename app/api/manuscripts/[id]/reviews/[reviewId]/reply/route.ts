import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string; reviewId: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Verify the user is the manuscript author
  const { data: manuscript } = await supabase
    .from('manuscripts')
    .select('author_id')
    .eq('id', params.id)
    .single()

  if (!manuscript || manuscript.author_id !== user.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { reply } = await request.json()
  if (!reply?.trim()) {
    return NextResponse.json({ error: 'La réponse ne peut pas être vide' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('reviews')
    .update({
      author_reply: reply.trim(),
      author_reply_at: new Date().toISOString(),
    })
    .eq('id', params.reviewId)
    .eq('manuscript_id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ review: data })
}
