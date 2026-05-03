import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/manuscripts/StatusBadge'
import { StarDisplay } from '@/components/reviews/StarRating'
import {
  PlusCircle,
  BookOpen,
  Star,
  MessageSquare,
  Eye,
  TrendingUp,
  Brain,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Manuscript } from '@/lib/types'

export default async function WriterDashboard() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: manuscripts } = await supabase
    .from('manuscripts')
    .select('*, ai_analysis:ai_analyses(overall_score, status)')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  const stats = {
    total: manuscripts?.length ?? 0,
    published: manuscripts?.filter((m) => ['published', 'community_validated', 'submitted_editors'].includes(m.status)).length ?? 0,
    totalReviews: manuscripts?.reduce((a, m) => a + (m.total_reviews ?? 0), 0) ?? 0,
    totalReads: manuscripts?.reduce((a, m) => a + (m.total_reads ?? 0), 0) ?? 0,
    avgRating: manuscripts && manuscripts.length > 0
      ? manuscripts.reduce((a, m) => a + (m.average_rating ?? 0), 0) / manuscripts.length
      : 0,
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-muted-foreground">Gérez vos manuscrits et suivez vos statistiques</p>
        </div>
        <Link href="/writer/manuscripts/new">
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            Nouveau manuscrit
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Manuscrits</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.published}</div>
                <div className="text-xs text-muted-foreground">Publiés</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Star className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '–'}
                </div>
                <div className="text-xs text-muted-foreground">Note moyenne</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalReviews}</div>
                <div className="text-xs text-muted-foreground">Critiques reçues</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manuscripts list */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Mes manuscrits</h2>

        {!manuscripts || manuscripts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">Aucun manuscrit</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Soumettez votre premier manuscrit pour commencer à recevoir des critiques.
              </p>
              <Link href="/writer/manuscripts/new">
                <Button>
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Soumettre un manuscrit
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {manuscripts.map((m: Manuscript & { ai_analysis?: { overall_score: number; status: string } | null }) => (
              <Card key={m.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/writer/manuscripts/${m.id}`}
                          className="font-medium text-gray-900 hover:text-primary transition-colors truncate block"
                        >
                          {m.title}
                        </Link>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{formatDate(m.created_at)}</span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" /> {m.total_reads}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> {m.total_reviews}
                          </span>
                          {m.average_rating > 0 && <StarDisplay rating={m.average_rating} />}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {m.ai_analysis && (
                        <div className="flex items-center gap-1 text-xs">
                          <Brain className="h-3.5 w-3.5 text-purple-600" />
                          <span className="text-purple-600 font-medium">
                            {m.ai_analysis.overall_score
                              ? `${m.ai_analysis.overall_score.toFixed(1)}/10`
                              : m.ai_analysis.status === 'processing'
                              ? 'En cours…'
                              : '–'}
                          </span>
                        </div>
                      )}
                      <StatusBadge status={m.status} />
                      <Link href={`/writer/manuscripts/${m.id}`}>
                        <Button variant="outline" size="sm">Voir</Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
