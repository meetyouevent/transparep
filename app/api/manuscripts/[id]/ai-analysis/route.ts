import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { analyzeManuscript, chunkCount } from '@/lib/anthropic/analyzer'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const serviceSupabase = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Fetch manuscript - must be owned by user and in draft state
  const { data: manuscript } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('id', params.id)
    .eq('author_id', user.id)
    .single()

  if (!manuscript) return NextResponse.json({ error: 'Manuscrit introuvable' }, { status: 404 })
  if (manuscript.status !== 'draft') {
    return NextResponse.json({ error: 'L\'analyse IA n\'est disponible que pour les brouillons' }, { status: 400 })
  }

  // Check if analysis already exists
  const { data: existingAnalysis } = await serviceSupabase
    .from('ai_analyses')
    .select('id, status')
    .eq('manuscript_id', params.id)
    .single()

  if (existingAnalysis?.status === 'processing') {
    return NextResponse.json({ error: 'Analyse déjà en cours' }, { status: 409 })
  }

  // Get PDF text from storage
  if (!manuscript.pdf_storage_path) {
    return NextResponse.json({ error: 'Aucun PDF associé à ce manuscrit' }, { status: 400 })
  }

  // Update manuscript status to ai_review
  await serviceSupabase
    .from('manuscripts')
    .update({ status: 'ai_review' })
    .eq('id', params.id)

  // Create or update analysis record
  const analysisData = {
    manuscript_id: params.id,
    status: 'processing' as const,
    chunks_analyzed: 0,
    total_chunks: 0,
  }

  let analysisId: string

  if (existingAnalysis) {
    await serviceSupabase
      .from('ai_analyses')
      .update(analysisData)
      .eq('id', existingAnalysis.id)
    analysisId = existingAnalysis.id
  } else {
    const { data: newAnalysis } = await serviceSupabase
      .from('ai_analyses')
      .insert(analysisData)
      .select('id')
      .single()
    analysisId = newAnalysis!.id
  }

  // Download PDF from storage and parse text
  const bucket = manuscript.pdf_storage_path.startsWith('manuscripts/') ? 'manuscripts' : 'excerpts'
  const storagePath = manuscript.pdf_storage_path.replace(/^(manuscripts|excerpts)\//, '')

  const { data: fileData, error: downloadError } = await serviceSupabase.storage
    .from(bucket)
    .download(storagePath)

  if (downloadError || !fileData) {
    await serviceSupabase
      .from('ai_analyses')
      .update({ status: 'failed', error_message: 'Impossible de télécharger le PDF' })
      .eq('id', analysisId)

    await serviceSupabase
      .from('manuscripts')
      .update({ status: 'draft' })
      .eq('id', params.id)

    return NextResponse.json({ error: 'Erreur de téléchargement du PDF' }, { status: 500 })
  }

  // Parse PDF text (server-side)
  let pdfText = ''
  try {
    const pdfParse = (await import('pdf-parse')).default
    const arrayBuffer = await fileData.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const parsed = await pdfParse(buffer)
    pdfText = parsed.text
  } catch (err) {
    await serviceSupabase
      .from('ai_analyses')
      .update({ status: 'failed', error_message: 'Impossible de lire le PDF' })
      .eq('id', analysisId)

    await serviceSupabase.from('manuscripts').update({ status: 'draft' }).eq('id', params.id)

    return NextResponse.json({ error: 'Erreur de lecture du PDF' }, { status: 500 })
  }

  if (pdfText.trim().length < 500) {
    await serviceSupabase
      .from('ai_analyses')
      .update({ status: 'failed', error_message: 'Le texte extrait est insuffisant (PDF scanné ?)' })
      .eq('id', analysisId)

    await serviceSupabase.from('manuscripts').update({ status: 'draft' }).eq('id', params.id)

    return NextResponse.json({ error: 'Texte insuffisant dans le PDF' }, { status: 400 })
  }

  // Calculate total chunks
  const totalChunks = chunkCount(pdfText)
  await serviceSupabase
    .from('ai_analyses')
    .update({ total_chunks: totalChunks })
    .eq('id', analysisId)

  // Run AI analysis
  try {
    let chunksAnalyzed = 0
    const results = await analyzeManuscript(
      pdfText,
      manuscript.genre,
      manuscript.target_audience ?? 'Grand public',
      async (done) => {
        chunksAnalyzed = done
        await serviceSupabase
          .from('ai_analyses')
          .update({ chunks_analyzed: done })
          .eq('id', analysisId)
      }
    )

    // Save results
    await serviceSupabase
      .from('ai_analyses')
      .update({
        ...results,
        status: 'completed',
        chunks_analyzed: chunksAnalyzed,
      })
      .eq('id', analysisId)

    // Publish the manuscript
    await serviceSupabase
      .from('manuscripts')
      .update({ status: 'published', word_count: pdfText.split(/\s+/).length })
      .eq('id', params.id)

    return NextResponse.json({ success: true, analysisId })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
    await serviceSupabase
      .from('ai_analyses')
      .update({ status: 'failed', error_message: errorMessage })
      .eq('id', analysisId)

    await serviceSupabase.from('manuscripts').update({ status: 'draft' }).eq('id', params.id)

    return NextResponse.json({ error: `Analyse échouée: ${errorMessage}` }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('ai_analyses')
    .select('*')
    .eq('manuscript_id', params.id)
    .single()

  if (error || !data) {
    return NextResponse.json({ analysis: null })
  }

  return NextResponse.json({ analysis: data })
}
