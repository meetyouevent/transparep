'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  MessageSquare,
  Loader2,
  Send,
  BookOpen,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import type { Message } from '@/lib/types'

export default function EditorMessagesPage() {
  const supabase = createClient()
  const { toast } = useToast()

  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Message | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id (id, full_name, email, avatar_url),
          recipient:profiles!recipient_id (id, full_name, email, avatar_url),
          manuscript:manuscripts (id, title)
        `)
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      setMessages(data ?? [])
      setLoading(false)
    }
    load()
  }, [supabase])

  const sendReply = async () => {
    if (!selected || !replyContent.trim()) return
    setSending(true)

    try {
      const recipientId = selected.sender_id === userId
        ? selected.recipient_id
        : selected.sender_id

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: userId,
          recipient_id: recipientId,
          manuscript_id: selected.manuscript_id,
          subject: `Re: ${selected.subject}`,
          content: replyContent.trim(),
        })
        .select(`
          *,
          sender:profiles!sender_id (id, full_name, email, avatar_url),
          recipient:profiles!recipient_id (id, full_name, email, avatar_url),
          manuscript:manuscripts (id, title)
        `)
        .single()

      if (error) throw error

      setMessages((m) => [data, ...m])
      setReplyContent('')
      toast({ title: 'Message envoyé' })
    } catch {
      toast({ title: 'Erreur', description: 'Impossible d\'envoyer', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  const unread = messages.filter((m) => m.recipient_id === userId && !m.read_at)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          {unread.length > 0 && (
            <Badge className="bg-red-500">{unread.length} non lu{unread.length > 1 ? 's' : ''}</Badge>
          )}
        </div>
        <p className="text-muted-foreground">Correspondance avec les auteurs</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 h-[600px]">
        {/* Message list */}
        <div className="md:col-span-1 border rounded-lg overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageSquare className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-muted-foreground">Aucun message</p>
            </div>
          ) : (
            messages.map((m) => {
              const isUnread = m.recipient_id === userId && !m.read_at
              const otherPerson = m.sender_id === userId ? m.recipient : m.sender
              const name = otherPerson?.full_name ?? otherPerson?.email ?? 'Inconnu'

              return (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className={`w-full p-4 text-left border-b hover:bg-gray-50 transition-colors ${
                    selected?.id === m.id ? 'bg-purple-50 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                        {name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${isUnread ? 'font-semibold' : 'font-medium'}`}>
                          {name}
                        </span>
                        {isUnread && <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0" />}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{m.subject}</div>
                      {m.manuscript && (
                        <div className="flex items-center gap-1 text-xs text-purple-600 mt-1">
                          <BookOpen className="h-3 w-3" />
                          <span className="truncate">{m.manuscript.title}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(m.created_at)}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Message detail */}
        <div className="md:col-span-2 border rounded-lg flex flex-col">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <MessageSquare className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-muted-foreground">Sélectionnez un message</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">{selected.subject}</h3>
                {selected.manuscript && (
                  <div className="flex items-center gap-1 text-xs text-purple-600 mt-1">
                    <BookOpen className="h-3 w-3" />
                    Manuscrit : {selected.manuscript.title}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs bg-purple-100 text-purple-700">
                      {(selected.sender?.full_name ?? selected.sender?.email ?? 'I').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-sm">
                      {selected.sender?.full_name ?? selected.sender?.email}
                    </div>
                    <div className="text-xs text-muted-foreground mb-3">{formatDate(selected.created_at)}</div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {selected.content}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reply */}
              <div className="p-4 border-t">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Votre réponse…"
                  rows={3}
                  className="resize-none mb-2"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={sendReply}
                    disabled={sending || !replyContent.trim()}
                  >
                    {sending ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Envoi…</>
                    ) : (
                      <><Send className="h-3.5 w-3.5 mr-1.5" /> Répondre</>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
