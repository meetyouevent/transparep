'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { PDFViewer } from '@/components/pdf/PDFViewer'
import { ReviewForm } from '@/components/reviews/ReviewForm'
import { ReviewCard } from '@/components/reviews/ReviewCard'
import { StatusBadge } from '@/components/manuscripts/StatusBadge'
import { StarDisplay } from '@/components/reviews/StarRating'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen,
  MessageSquare,
  Eye,
  PenLine,
  Loader2,
  FileText,
  Target,
  User,
} from 'lucide-react'
import { GENRE_LABELS } from '@/lib/types'
import { formatDate, pluralize } from '@/lib/utils'
import type { Manuscript, Review } from '@/lib/types'

export default function ReadManuscriptPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [manuscript, setManuscript] = useState<Manuscript | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [userReview, setUserReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('read')

  useEffect(() => {
    async function load() {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserEmail(user.email ?? '')

      // Fetch manuscript
      const res = await fetch(`/api/manuscripts/${id}`)
      if (!res.ok) { setLoading(false); return }
      const { manuscript: m } = await res.json()
      setManuscript(m)

      // Fetch reviews
      const reviewRes = await fetch(`/api/manuscripts/${id}/reviews`)
      if (reviewRes.ok) {
        const { reviews: r } = await reviewRes.json()
        setReviews(r ?? [])
        if (user) {
          const myReview = r?.find((rv: Review) => rv.reviewer_id === user.id)
          setUserReview(myReview ?? null)
        }
      }

      // Get PDF signed URL
      const pdfRes = await fetch(`/api/manuscripts/${id}/pdf?type=excerpt`)
      if (pdfRes.ok) {
        const { url } = await pdfRes.json()
        setPdfUrl(url)
      }

      setLoading(false)
    }
    load()
  }, [id, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!manuscript) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Manuscrit introuvable</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-gray-900 truncate">{manuscript.title}</h1>
            <StatusBadge status={manuscript.status} />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {manuscript.author?.full_name ?? manuscript.author?.email ?? 'Auteur inconnu'}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              {GENRE_LABELS[manuscript.genre]}
            </span>
            {manuscript.page_count && (
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" /> {manuscript.page_count} p.
              </span>
            )}
            {manuscript.target_audience && (
              <span className="flex items-center gap-1">
                <Target className="h-3.5 w-3.5" /> {manuscript.target_audience}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {manuscript.total_reads}
            </span>
            {manuscript.average_rating > 0 && (
              <StarDisplay rating={manuscript.average_rating} />
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="h-full flex flex-col"
        >
          <div className="border-b px-6 pt-2">
            <TabsList>
              <TabsTrigger value="read" className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" />
                Lire
              </TabsTrigger>
              <TabsTrigger value="review" className="flex items-center gap-1.5">
                <PenLine className="h-4 w-4" />
                {userReview ? 'Ma critique' : 'Critiquer'}
              </TabsTrigger>
              <TabsTrigger value="reviews" className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Critiques ({reviews.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="read" className="flex-1 overflow-auto mt-0 p-0">
            <div className="p-6">
              {manuscript.summary && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg max-w-3xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Résumé</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{manuscript.summary}</p>
                </div>
              )}

              {pdfUrl ? (
                <PDFViewer pdfUrl={pdfUrl} watermarkEmail={userEmail} />
              ) : (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-muted-foreground">PDF non disponible</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="review" className="flex-1 overflow-auto mt-0">
            <div className="p-6 max-w-2xl">
              {userReview ? (
                <div>
                  <h2 className="text-lg font-semibold mb-4">Ma critique</h2>
                  <ReviewCard review={userReview} canReply={false} />
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-semibold mb-2">Rédiger une critique</h2>
                  <p className="text-sm text-muted-foreground mb-6">
                    Partagez votre avis constructif sur ce manuscrit. Votre critique aidera l'auteur à progresser.
                  </p>
                  <ReviewForm
                    manuscriptId={manuscript.id}
                    onSuccess={() => {
                      setActiveTab('reviews')
                    }}
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reviews" className="flex-1 overflow-auto mt-0">
            <div className="p-6 max-w-2xl">
              <h2 className="text-lg font-semibold mb-4">
                {pluralize(reviews.length, 'critique', 'critiques')}
              </h2>

              {reviews.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Soyez le premier à critiquer ce manuscrit !
                    </p>
                    <Button
                      className="mt-4"
                      variant="outline"
                      onClick={() => setActiveTab('review')}
                    >
                      Rédiger une critique
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
