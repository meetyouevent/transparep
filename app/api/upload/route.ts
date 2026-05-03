import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(request: Request) {
  const supabase = createClient()
  const serviceSupabase = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Verify writer role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'writer') {
    return NextResponse.json({ error: 'Seuls les écrivains peuvent uploader des manuscrits' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const type = (formData.get('type') as string) ?? 'manuscript' // 'manuscript' | 'excerpt'

  if (!file) return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Seuls les fichiers PDF sont acceptés' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: `Le fichier dépasse la taille maximale de ${MAX_SIZE / 1024 / 1024} Mo` }, { status: 400 })
  }

  const bucket = type === 'excerpt' ? 'excerpts' : 'manuscripts'
  const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { data, error } = await serviceSupabase.storage
    .from(bucket)
    .upload(fileName, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const storagePath = `${bucket}/${data.path}`

  return NextResponse.json({
    storagePath,
    path: data.path,
    bucket,
    size: file.size,
  })
}
