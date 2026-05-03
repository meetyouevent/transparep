'use client'

import { AIRadarChart } from '@/components/charts/AIRadarChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { AI_DIMENSIONS, type AIAnalysis } from '@/lib/types'
import { getScoreColor, getScoreBg } from '@/lib/utils'
import { Brain, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface AIReportProps {
  analysis: AIAnalysis
}

export function AIReport({ analysis }: AIReportProps) {
  if (analysis.status === 'pending' || analysis.status === 'processing') {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900">Analyse IA en cours…</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {analysis.chunks_analyzed > 0
              ? `Extrait ${analysis.chunks_analyzed} / ${analysis.total_chunks} analysé`
              : 'Démarrage de l\'analyse…'}
          </p>
          {analysis.total_chunks > 0 && (
            <div className="mt-4 max-w-xs mx-auto">
              <Progress value={(analysis.chunks_analyzed / analysis.total_chunks) * 100} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (analysis.status === 'failed') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900">Analyse échouée</h3>
          <p className="text-sm text-muted-foreground mt-2">{analysis.error_message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
          <Brain className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Rapport de Pré-lecture IA</h2>
          <p className="text-sm text-muted-foreground">Analyse sur 8 dimensions — Propulsé par Claude Opus</p>
        </div>
        {analysis.overall_score !== null && (
          <div className="ml-auto text-right">
            <div className={`text-3xl font-bold ${getScoreColor(analysis.overall_score)}`}>
              {analysis.overall_score.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">/ 10</div>
          </div>
        )}
      </div>

      {/* Radar Chart */}
      <Card>
        <CardContent className="pt-6">
          <AIRadarChart analysis={analysis} />
        </CardContent>
      </Card>

      {/* Score bars */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scores par dimension</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {AI_DIMENSIONS.map(({ key, label }) => {
            const score = analysis[key as keyof AIAnalysis] as number | null
            if (score === null) return null
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}/10</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      score >= 8 ? 'bg-green-500' : score >= 6 ? 'bg-yellow-500' : score >= 4 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${score * 10}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Global summary */}
      {analysis.global_summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Synthèse globale</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 leading-relaxed">{analysis.global_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Strengths & Improvements */}
      <div className="grid md:grid-cols-2 gap-4">
        {analysis.key_strengths.length > 0 && (
          <Card className="border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Points forts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2">
                {analysis.key_strengths.map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {analysis.key_improvements.length > 0 && (
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Pistes d'amélioration
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2">
                {analysis.key_improvements.map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    {s}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Grammar errors */}
      {analysis.grammar_errors && analysis.grammar_errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Erreurs grammaticales récurrentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.grammar_errors.map((err, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-red-50 rounded">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{err.type}</span>
                    {err.example && (
                      <span className="text-xs text-muted-foreground ml-2 italic">ex: "{err.example}"</span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-red-600">{err.count}×</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dimension-level feedback */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Analyse détaillée par dimension</h3>
        {AI_DIMENSIONS.map(({ key, label, feedbackKey }) => {
          const score = analysis[key as keyof AIAnalysis] as number | null
          const feedback = analysis[feedbackKey as keyof AIAnalysis] as string | null
          if (!feedback) return null
          return (
            <Card key={key}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{label}</h4>
                  {score !== null && (
                    <span
                      className={`text-sm font-bold px-2 py-0.5 rounded ${getScoreBg(score)} ${getScoreColor(score)}`}
                    >
                      {score}/10
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{feedback}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
