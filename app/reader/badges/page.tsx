import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'

export default async function BadgesPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('total_reviews_given')
    .eq('id', user.id)
    .single()

  const { data: allBadges } = await supabase
    .from('badges')
    .select('*')
    .order('criteria_value', { ascending: true })

  const { data: earnedBadges } = await supabase
    .from('user_badges')
    .select('badge_id, earned_at')
    .eq('user_id', user.id)

  const earnedSet = new Set(earnedBadges?.map((b) => b.badge_id) ?? [])
  const earnedDateMap = new Map(earnedBadges?.map((b) => [b.badge_id, b.earned_at]) ?? [])

  const reviewsDone = profile?.total_reviews_given ?? 0

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Mes badges</h1>
        <p className="text-muted-foreground">
          Vous avez rédigé {reviewsDone} critique{reviewsDone !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allBadges?.map((badge) => {
          const earned = earnedSet.has(badge.id)
          const earnedDate = earnedDateMap.get(badge.id)
          const progress = Math.min(100, (reviewsDone / badge.criteria_value) * 100)

          return (
            <Card
              key={badge.id}
              className={earned ? 'border-amber-200 bg-amber-50' : 'opacity-60'}
            >
              <CardContent className="pt-6 text-center">
                <div className="text-4xl mb-3">{badge.icon}</div>
                <h3 className="font-semibold text-gray-900">{badge.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>

                {earned ? (
                  <div className="mt-3 text-xs text-amber-700 font-medium">
                    ✓ Obtenu le {formatDate(earnedDate!)}
                  </div>
                ) : (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-1">
                      {reviewsDone} / {badge.criteria_value} critiques
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
