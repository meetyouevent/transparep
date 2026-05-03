'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StarDisplay } from '@/components/reviews/StarRating'
import {
  Search,
  Download,
  MessageSquare,
  BookOpen,
  Star,
  Eye,
  Send,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { GENRE_LABELS } from '@/lib/types'
import { truncate, formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import type { Manuscript } from '@/lib/types'

export default function EditorCataloguePage() {
  const { toast } = useToast()
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const [filters, setFilters] = useState({
    genre: 'all',
    sort: 'rating',
    min_rating: '4',
    q: '',
  })

  const [messageDialog, setMessageDialog] = useState<{
    open: boolean
    manuscript?: Manuscript
  }>({ open: false })
  const [messageForm, setMessageForm] = useState({ subject: '', content: '' })
  const [sendingMessage, setSendingMessage] = useState(false)

  const fetchManuscripts = useCallback(async (pageNum = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.genre && filters.genre !== 'all') params.set('genre', filters.genre)
    params.set('sort', filters.sort)
    if (filters.min_rating) params.set('min_rating', filters.min_rating)
    if (filters.q) params.set('q', filters.q)
    params.set('page', String(pageNum))

    const res = await fetch(`/api/manuscripts?${params}`)
    const data = await res.json()

    // Filter to community validated or submitted_editors
    const filtered = (data.manuscripts ?? []).filter(
      (m: Manuscript) => ['community_validated', 'submitted_editors'].includes(m.status) && m.total_reviews >= 20
    )

    if (pageNum === 1) {
      setManuscripts(filtered)
    } else {
      setManuscripts((prev) => [...prev, ...filtered])
    }
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [filters])

  useEffect(() => {
    setPage(1)
    fetchManuscripts(1)
  }, [filters, fetchManuscripts])

  const sendMessage = async () => {
    if (!messageDialog.manuscript || !messageForm.subject || !messageForm.content) return
    setSendingMessage(true)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: messageDialog.manuscript.author_id,
          manuscript_id: messageDialog.manuscript.id,
          subject: messageForm.subject,
          content: messageForm.content,
        }),
      })

      if (!res.ok) throw new Error('Erreur d\'envoi')

      toast({ title: 'Message envoyé !', description: 'L\'auteur recevra votre message.' })
      setMessageDialog({ open: false })
      setMessageForm({ subject: '', content: '' })
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'envoyer le message', variant: 'destructive' })
    } finally {
      setSendingMessage(false)
    }
  }

  const requestDownload = async (manuscript: Manuscript) => {
    const res = await fetch('/api/download-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manuscript_id: manuscript.id }),
    })
    if (res.ok) {
      toast({ title: 'Demande envoyée', description: 'L\'auteur sera notifié de votre demande.' })
    } else {
      const err = await res.json()
      toast({ title: 'Erreur', description: err.error, variant: 'destructive' })
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Catalogue éditeur</h1>
            <p className="text-muted-foreground">
              Manuscrits validés par la communauté (note ≥ 4/5 · 20+ critiques)
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-xl border">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="pl-9"
          />
        </div>

        <Select value={filters.genre} onValueChange={(v) => setFilters((f) => ({ ...f, genre: v }))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Genre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les genres</SelectItem>
            {Object.entries(GENRE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.min_rating} onValueChange={(v) => setFilters((f) => ({ ...f, min_rating: v }))}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Note min" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="4">≥ 4/5</SelectItem>
            <SelectItem value="4.5">≥ 4.5/5</SelectItem>
            <SelectItem value="3.5">≥ 3.5/5</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sort} onValueChange={(v) => setFilters((f) => ({ ...f, sort: v }))}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Trier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rating">Mieux notés</SelectItem>
            <SelectItem value="reviews">Plus critiqués</SelectItem>
            <SelectItem value="created_at">Plus récents</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {loading && manuscripts.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : manuscripts.length === 0 ? (
        <div className="text-center py-24">
          <SlidersHorizontal className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h3 className="font-medium text-gray-900">Aucun manuscrit trouvé</h3>
          <p className="text-sm text-muted-foreground mt-1">Essayez de modifier vos filtres</p>
        </div>
      ) : (
        <div className="space-y-4">
          {manuscripts.map((m) => (
            <Card key={m.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{m.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>
                            par {m.author?.full_name ?? m.author?.email ?? 'Auteur inconnu'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {GENRE_LABELS[m.genre]}
                          </Badge>
                          {m.page_count && <span>{m.page_count} pages</span>}
                          {m.target_audience && (
                            <span className="hidden lg:inline">• {m.target_audience}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {m.summary && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {truncate(m.summary, 200)}
                      </p>
                    )}

                    <div className="flex items-center gap-5 text-sm">
                      <StarDisplay rating={m.average_rating} size="sm" />
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {m.total_reviews} critiques
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" />
                        {m.total_reads} lectures
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(m.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMessageDialog({ open: true, manuscript: m })}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Contacter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => requestDownload(m)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Demander PDF
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Message Dialog */}
      <Dialog
        open={messageDialog.open}
        onOpenChange={(open) => setMessageDialog((d) => ({ ...d, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contacter l'auteur</DialogTitle>
            <DialogDescription>
              Envoyer un message à l'auteur de «{messageDialog.manuscript?.title}»
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="msg-subject">Objet</Label>
              <Input
                id="msg-subject"
                value={messageForm.subject}
                onChange={(e) => setMessageForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Intérêt pour votre manuscrit"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg-content">Message</Label>
              <Textarea
                id="msg-content"
                value={messageForm.content}
                onChange={(e) => setMessageForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="Votre message..."
                rows={5}
                className="resize-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageDialog({ open: false })}>
              Annuler
            </Button>
            <Button
              onClick={sendMessage}
              disabled={sendingMessage || !messageForm.subject || !messageForm.content}
            >
              {sendingMessage ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi…</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Envoyer</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
