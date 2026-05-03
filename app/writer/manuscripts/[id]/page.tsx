import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/manuscripts/StatusBadge'
import { ReviewCard } from '@/components/reviews/ReviewCard'
import { AIReport } from '@/components/ai/AIReport'
import { StarDisplay } from '@/components/reviews/StarRating'
import {
  Brain,
  Eye,
  MessageSquare,
  BookOpen,
  Calendar,
  Target,
  FileText,
} from 'lucide-react'
import { formatDate, pluralize } from '@/lib/utils'
import { GENRE_LABELS } from '@/lib/types'
import type { Review } from '@/lib/types'

interface Props {
  params: { id: string }
}

export default async function ManuscriptDetailPage({ params }: Props) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: manuscript } = await supabase
    .from('manuscripts')
    .select('*')
    .eq('id', params.id)
    .eq('author_id', user.id)
    .single()

  if (!manuscript) notFound()

  const { data: aiAnalysis } = await supabase
    .from('ai_analyses')
    .select('*')
    .eq('manuscript_id', params.id)
    .single()

  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      *,
      reviewer:profiles!reviewer_id (id, full_name, email, avatar_url)
    `)
    .eq('manuscript_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{manuscript.title}</h1>
              <StatusBadge status={manuscript.status} />
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {GENRE_LABELS[manuscript.genre as keyof typeof GENRE_LABELS]}
              </span>
              {manuscript.page_count && (
                <span className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {manuscript.page_count} pages
                </span>
              )}
              {manuscript.target_audience && (
                <span className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  {manuscript.target_audience}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(manuscript.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{pluralize(manuscript.total_reads, 'lecture', 'lectures')}</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{pluralize(manuscript.total_reviews, 'critique', 'critiques')}</span>
          </div>
          {manuscript.average_rating > 0 && (
            <StarDisplay rating={manuscript.average_rating} size="md" />
          )}
          {aiAnalysis?.overall_score && (
            <div className="flex items-center gap-1.5 text-sm">
              <Brain className="h-4 w-4 text-purple-600" />
              <span className="text-purple-600 font-medium">{aiAnalysis.overall_score.toFixed(1)}/10 IA</span>
            </div>
          )}
        </div>

        {manuscript.summary && (
          <p className="mt-4 text-gray-700 text-sm leading-relaxed max-w-2xl">{manuscript.summary}</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={aiAnalysis ? 'ai' : 'reviews'}>
        <TabsList>
          {aiAnalysis && (
            <TabsTrigger value="ai" className="flex items-center gap-1.5">
              <Brain className="h-4 w-4" />
              Rapport IA
            </TabsTrigger>
          )}
          <TabsTrigger value="reviews" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Critiques ({manuscript.total_reviews})
          </TabsTrigger>
        </TabsList>

        {aiAnalysis && (
          <TabsContent value="ai" className="mt-6">
            <AIReport analysis={aiAnalysis} />
          </TabsContent>
        )}

        <TabsContent value="reviews" className="mt-6">
          {!reviews || reviews.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <h3 className="font-medium text-gray-900 mb-1">Aucune critique pour l'instant</h3>
                <p className="text-sm text-muted-foreground">
                  {['published', 'community_validated', 'submitted_editors'].includes(manuscript.status)
                    ? 'Les lecteurs n\'ont pas encore critiqué ce manuscrit.'
                    : 'Les critiques seront disponibles une fois le manuscrit publié.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {reviews.map((review: Review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  canReply={true}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
