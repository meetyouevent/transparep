'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { StarRating } from './StarRating'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, CheckCircle } from 'lucide-react'

interface ReviewFormProps {
  manuscriptId: string
  onSuccess?: () => void
}

export function ReviewForm({ manuscriptId, onSuccess }: ReviewFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [ratings, setRatings] = useState({
    style_rating: 0,
    originality_rating: 0,
    narrative_rating: 0,
    emotion_rating: 0,
  })
  const [strengths, setStrengths] = useState('')
  const [improvements, setImprovements] = useState('')

  const allRated = Object.values(ratings).every((r) => r > 0)
  const totalChars = strengths.length + improvements.length
  const isValid = allRated && strengths.length >= 50 && improvements.length >= 50

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setLoading(true)
    try {
      const res = await fetch(`/api/manuscripts/${manuscriptId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ratings, strengths, improvements }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erreur lors de l\'envoi')
      }

      setSubmitted(true)
      toast({ title: 'Critique publiée !', description: 'Merci pour votre contribution.' })
      onSuccess?.()
    } catch (err: unknown) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Une erreur est survenue',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">Critique publiée !</h3>
        <p className="text-muted-foreground mt-2">Merci pour votre contribution à la communauté.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Notation sur 4 critères</h3>
        <div className="grid grid-cols-2 gap-6">
          <StarRating
            label="Style d'écriture"
            value={ratings.style_rating}
            onChange={(v) => setRatings((r) => ({ ...r, style_rating: v }))}
            size="md"
          />
          <StarRating
            label="Originalité"
            value={ratings.originality_rating}
            onChange={(v) => setRatings((r) => ({ ...r, originality_rating: v }))}
            size="md"
          />
          <StarRating
            label="Construction narrative"
            value={ratings.narrative_rating}
            onChange={(v) => setRatings((r) => ({ ...r, narrative_rating: v }))}
            size="md"
          />
          <StarRating
            label="Émotion / Impact"
            value={ratings.emotion_rating}
            onChange={(v) => setRatings((r) => ({ ...r, emotion_rating: v }))}
            size="md"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="strengths" className="flex items-center justify-between mb-1.5">
            <span>✅ Points forts <span className="text-red-500">*</span></span>
            <span className={`text-xs ${strengths.length < 50 ? 'text-red-500' : 'text-green-600'}`}>
              {strengths.length} / 50 min
            </span>
          </Label>
          <Textarea
            id="strengths"
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="Décrivez les points forts du manuscrit : ce qui vous a marqué, ce qui fonctionne bien..."
            rows={4}
            className="resize-none"
          />
        </div>

        <div>
          <Label htmlFor="improvements" className="flex items-center justify-between mb-1.5">
            <span>🔧 Pistes d'amélioration <span className="text-red-500">*</span></span>
            <span className={`text-xs ${improvements.length < 50 ? 'text-red-500' : 'text-green-600'}`}>
              {improvements.length} / 50 min
            </span>
          </Label>
          <Textarea
            id="improvements"
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            placeholder="Suggérez des améliorations constructives : ce qui pourrait être développé, restructuré..."
            rows={4}
            className="resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          Critique en {totalChars} caractères
          {totalChars < 200 && ` (min. 200 au total)`}
        </p>
        <Button type="submit" disabled={!isValid || loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Publication...
            </>
          ) : (
            'Publier ma critique'
          )}
        </Button>
      </div>
    </form>
  )
}
