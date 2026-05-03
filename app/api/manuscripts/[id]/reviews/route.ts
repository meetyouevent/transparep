import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const perPage = 10

  const { data, error, count } = await supabase
    .from('reviews')
    .select(`
      *,
      reviewer:profiles!reviewer_id (id, full_name, email, avatar_url)
    `, { count: 'exact' })
    .eq('manuscript_id', params.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reviews: data, total: count, page, perPage })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Verify manuscript is published
  const { data: manuscript } = await supabase
    .from('manuscripts')
    .select('status, author_id')
    .eq('id', params.id)
    .single()

  if (!manuscript) return NextResponse.json({ error: 'Manuscrit introuvable' }, { status: 404 })
  if (manuscript.author_id === user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas critiquer votre propre manuscrit' }, { status: 400 })
  }
  if (!['published', 'community_validated', 'submitted_editors'].includes(manuscript.status)) {
    return NextResponse.json({ error: 'Ce manuscrit n\'est pas disponible pour critique' }, { status: 400 })
  }

  const body = await request.json()
  const { style_rating, originality_rating, narrative_rating, emotion_rating, strengths, improvements } = body

  // Validate
  if (!style_rating || !originality_rating || !narrative_rating || !emotion_rating) {
    return NextResponse.json({ error: 'Tous les critères doivent être notés' }, { status: 400 })
  }
  if (!strengths || strengths.length < 50 || !improvements || improvements.length < 50) {
    return NextResponse.json({ error: 'Les sections points forts et améliorations doivent faire au moins 50 caractères' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      manuscript_id: params.id,
      reviewer_id: user.id,
      style_rating,
      originality_rating,
      narrative_rating,
      emotion_rating,
      strengths,
      improvements,
    })
    .select(`
      *,
      reviewer:profiles!reviewer_id (id, full_name, email, avatar_url)
    `)
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Vous avez déjà soumis une critique pour ce manuscrit' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Track the read
  await supabase.from('manuscript_reads').insert({
    manuscript_id: params.id,
    reader_id: user.id,
  })

  return NextResponse.json({ review: data }, { status: 201 })
}
