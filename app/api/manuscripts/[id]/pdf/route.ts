import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') ?? 'excerpt' // 'excerpt' | 'full'

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch manuscript
  const { data: manuscript } = await supabase
    .from('manuscripts')
    .select('pdf_storage_path, excerpt_storage_path, visibility, author_id, status')
    .eq('id', params.id)
    .single()

  if (!manuscript) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  let storagePath: string | null = null

  if (type === 'full') {
    // Full PDF: only author, or editors with approved download request
    if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

    if (manuscript.author_id === user.id) {
      storagePath = manuscript.pdf_storage_path
    } else {
      // Check if editor has approved download request
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'editor') {
        const { data: downloadReq } = await supabase
          .from('download_requests')
          .select('status')
          .eq('editor_id', user.id)
          .eq('manuscript_id', params.id)
          .eq('status', 'approved')
          .single()
        if (downloadReq) storagePath = manuscript.pdf_storage_path
      }
    }
  } else {
    // Excerpt: publicly accessible for published manuscripts
    if (['published', 'community_validated', 'submitted_editors'].includes(manuscript.status)) {
      storagePath = manuscript.excerpt_storage_path ?? manuscript.pdf_storage_path
    } else if (user && manuscript.author_id === user.id) {
      storagePath = manuscript.excerpt_storage_path ?? manuscript.pdf_storage_path
    }
  }

  if (!storagePath) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Generate signed URL (5 minutes)
  const serviceSupabase = createServiceClient()
  const bucket = storagePath.startsWith('excerpts/') ? 'excerpts' : 'manuscripts'
  const path = storagePath.replace(/^(manuscripts|excerpts)\//, '')

  const { data: signed, error } = await serviceSupabase.storage
    .from(bucket)
    .createSignedUrl(path, 300)

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'Impossible de générer l\'URL' }, { status: 500 })
  }

  // Track read (fire-and-forget; trigger handles total_reads update)
  if (user) {
    await supabase.from('manuscript_reads').insert({
      manuscript_id: params.id,
      reader_id: user.id,
    })
  }

  return NextResponse.json({ url: signed.signedUrl, expiresIn: 300 })
}
