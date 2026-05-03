import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  const genre = searchParams.get('genre')
  const sortBy = searchParams.get('sort') ?? 'created_at'
  const minRating = searchParams.get('min_rating')
  const search = searchParams.get('q')
  const page = parseInt(searchParams.get('page') ?? '1')
  const perPage = 12

  let query = supabase
    .from('manuscripts')
    .select(`
      *,
      author:profiles!author_id (id, full_name, email, avatar_url)
    `, { count: 'exact' })
    .in('status', ['published', 'community_validated', 'submitted_editors'])
    .range((page - 1) * perPage, page * perPage - 1)

  if (genre && genre !== 'all') {
    query = query.eq('genre', genre)
  }

  if (minRating) {
    query = query.gte('average_rating', parseFloat(minRating))
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`)
  }

  const sortMap: Record<string, string> = {
    created_at: 'created_at',
    rating: 'average_rating',
    reviews: 'total_reviews',
    reads: 'total_reads',
  }
  const sortColumn = sortMap[sortBy] ?? 'created_at'
  query = query.order(sortColumn, { ascending: false })

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ manuscripts: data, total: count, page, perPage })
}
