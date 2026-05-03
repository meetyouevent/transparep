import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('manuscripts')
    .select(`
      *,
      author:profiles!author_id (id, full_name, email, avatar_url, bio),
      ai_analysis:ai_analyses (*)
    `)
    .eq('id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Manuscrit introuvable' }, { status: 404 })
  }

  return NextResponse.json({ manuscript: data })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const allowedFields = ['title', 'genre', 'summary', 'target_audience', 'page_count', 'visibility', 'status']
  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  const { data, error } = await supabase
    .from('manuscripts')
    .update(updates)
    .eq('id', params.id)
    .eq('author_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ manuscript: data })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const serviceSupabase = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Get manuscript to delete storage files
  const { data: manuscript } = await supabase
    .from('manuscripts')
    .select('pdf_storage_path, excerpt_storage_path, cover_storage_path')
    .eq('id', params.id)
    .eq('author_id', user.id)
    .single()

  if (!manuscript) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  // Delete from storage
  const paths = [manuscript.pdf_storage_path, manuscript.excerpt_storage_path, manuscript.cover_storage_path].filter(Boolean) as string[]
  for (const path of paths) {
    const bucket = path.startsWith('manuscripts/') ? 'manuscripts' : 'excerpts'
    await serviceSupabase.storage.from(bucket).remove([path])
  }

  const { error } = await supabase
    .from('manuscripts')
    .delete()
    .eq('id', params.id)
    .eq('author_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
