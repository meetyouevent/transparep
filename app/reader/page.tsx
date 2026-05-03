'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ManuscriptCard } from '@/components/manuscripts/ManuscriptCard'
import { Button } from '@/components/ui/button'
import { Search, SlidersHorizontal, Loader2 } from 'lucide-react'
import { GENRE_LABELS } from '@/lib/types'
import type { Manuscript } from '@/lib/types'

export default function ReaderCataloguePage() {
  const [manuscripts, setManuscripts] = useState<Manuscript[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const [filters, setFilters] = useState({
    genre: 'all',
    sort: 'created_at',
    min_rating: '',
    q: '',
  })

  const fetchManuscripts = useCallback(async (pageNum = 1) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.genre && filters.genre !== 'all') params.set('genre', filters.genre)
    if (filters.sort) params.set('sort', filters.sort)
    if (filters.min_rating) params.set('min_rating', filters.min_rating)
    if (filters.q) params.set('q', filters.q)
    params.set('page', String(pageNum))

    const res = await fetch(`/api/manuscripts?${params}`)
    const data = await res.json()

    if (pageNum === 1) {
      setManuscripts(data.manuscripts ?? [])
    } else {
      setManuscripts((prev) => [...prev, ...(data.manuscripts ?? [])])
    }
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [filters])

  useEffect(() => {
    setPage(1)
    fetchManuscripts(1)
  }, [filters, fetchManuscripts])

  const loadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchManuscripts(nextPage)
  }

  const hasMore = manuscripts.length < total

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Catalogue des manuscrits</h1>
        <p className="text-muted-foreground">
          {total > 0 ? `${total} manuscrit${total > 1 ? 's' : ''} disponible${total > 1 ? 's' : ''}` : 'Découvrez des œuvres inédites'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-xl border">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par titre, résumé…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="pl-9"
          />
        </div>

        <Select
          value={filters.genre}
          onValueChange={(v) => setFilters((f) => ({ ...f, genre: v }))}
        >
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

        <Select
          value={filters.sort}
          onValueChange={(v) => setFilters((f) => ({ ...f, sort: v }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Plus récents</SelectItem>
            <SelectItem value="rating">Mieux notés</SelectItem>
            <SelectItem value="reviews">Plus critiqués</SelectItem>
            <SelectItem value="reads">Plus lus</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.min_rating}
          onValueChange={(v) => setFilters((f) => ({ ...f, min_rating: v }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Note minimale" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Toutes les notes</SelectItem>
            <SelectItem value="4">≥ 4/5</SelectItem>
            <SelectItem value="3.5">≥ 3.5/5</SelectItem>
            <SelectItem value="3">≥ 3/5</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
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
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {manuscripts.map((m) => (
              <Link key={m.id} href={`/reader/read/${m.id}`}>
                <ManuscriptCard
                  manuscript={m}
                  showAuthor
                />
              </Link>
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Chargement…</>
                ) : (
                  'Charger plus'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
