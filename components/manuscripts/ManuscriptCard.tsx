import { Star, Eye, MessageSquare, BookOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from './StatusBadge'
import { GENRE_LABELS } from '@/lib/types'
import { formatDate, truncate } from '@/lib/utils'
import type { Manuscript } from '@/lib/types'

interface ManuscriptCardProps {
  manuscript: Manuscript
  showStatus?: boolean
  showAuthor?: boolean
}

export function ManuscriptCard({ manuscript, showStatus = false, showAuthor = false }: ManuscriptCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow overflow-hidden">
      <CardContent className="p-0">
        {/* Cover placeholder */}
        <div className="h-32 bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
          <BookOpen className="h-10 w-10 text-purple-300" />
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
              {manuscript.title}
            </h3>
            {showStatus && <StatusBadge status={manuscript.status} className="flex-shrink-0" />}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {GENRE_LABELS[manuscript.genre]}
            </span>
            {manuscript.page_count && (
              <span className="text-xs text-muted-foreground">{manuscript.page_count} p.</span>
            )}
          </div>

          {showAuthor && manuscript.author && (
            <p className="text-xs text-muted-foreground mb-2">
              par {manuscript.author.full_name ?? manuscript.author.email}
            </p>
          )}

          {manuscript.summary && (
            <p className="text-xs text-gray-600 mb-3 line-clamp-2">
              {truncate(manuscript.summary, 100)}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {manuscript.average_rating > 0
                  ? manuscript.average_rating.toFixed(1)
                  : '–'}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {manuscript.total_reviews}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {manuscript.total_reads}
              </span>
            </div>
            <span>{formatDate(manuscript.created_at)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
