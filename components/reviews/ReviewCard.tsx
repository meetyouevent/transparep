'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { StarDisplay } from './StarRating'
import { formatDate } from '@/lib/utils'
import { MessageSquare, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import type { Review } from '@/lib/types'

interface ReviewCardProps {
  review: Review
  canReply?: boolean
  onReplyAdded?: () => void
}

export function ReviewCard({ review, canReply = false, onReplyAdded }: ReviewCardProps) {
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [reply, setReply] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reviewerName = review.reviewer?.full_name ?? review.reviewer?.email ?? 'Anonyme'
  const initials = reviewerName.slice(0, 2).toUpperCase()

  const submitReply = async () => {
    if (!reply.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/manuscripts/${review.manuscript_id}/reviews/${review.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast({ title: 'Réponse publiée' })
      setShowReplyForm(false)
      onReplyAdded?.()
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de publier la réponse', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-sm">{reviewerName}</div>
              <div className="text-xs text-muted-foreground">{formatDate(review.created_at)}</div>
            </div>
          </div>
          <StarDisplay rating={review.overall_rating} />
        </div>

        {/* Criteria breakdown */}
        <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
          {[
            { label: 'Style', value: review.style_rating },
            { label: 'Originalité', value: review.originality_rating },
            { label: 'Narration', value: review.narrative_rating },
            { label: 'Émotion', value: review.emotion_rating },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-1.5 bg-gray-50 rounded">
              <div className="font-semibold text-gray-900">{value}/5</div>
              <div className="text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <div className="text-xs font-medium text-green-700 mb-1">✅ Points forts</div>
            <p className={`text-sm text-gray-700 ${!expanded && 'line-clamp-3'}`}>{review.strengths}</p>
          </div>
          <div>
            <div className="text-xs font-medium text-blue-700 mb-1">🔧 Pistes d'amélioration</div>
            <p className={`text-sm text-gray-700 ${!expanded && 'line-clamp-3'}`}>{review.improvements}</p>
          </div>
        </div>

        {(review.strengths.length > 200 || review.improvements.length > 200) && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 text-xs text-primary flex items-center gap-1"
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3" /> Réduire</>
            ) : (
              <><ChevronDown className="h-3 w-3" /> Lire la suite</>
            )}
          </button>
        )}

        {/* Author reply */}
        {review.author_reply && (
          <div className="mt-4 pl-4 border-l-2 border-purple-200">
            <div className="text-xs font-medium text-purple-700 mb-1">Réponse de l'auteur</div>
            <p className="text-sm text-gray-700">{review.author_reply}</p>
            {review.author_reply_at && (
              <p className="text-xs text-muted-foreground mt-1">{formatDate(review.author_reply_at)}</p>
            )}
          </div>
        )}

        {/* Reply form */}
        {canReply && !review.author_reply && (
          <div className="mt-4">
            {showReplyForm ? (
              <div className="space-y-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Répondez à cette critique..."
                  rows={3}
                  className="resize-none text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitReply} disabled={submitting || !reply.trim()}>
                    <Send className="h-3 w-3 mr-1.5" />
                    Publier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowReplyForm(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowReplyForm(true)}
                className="text-xs"
              >
                <MessageSquare className="h-3 w-3 mr-1.5" />
                Répondre
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
