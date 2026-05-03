'use client'

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { AIAnalysis } from '@/lib/types'

interface AIRadarChartProps {
  analysis: AIAnalysis
}

export function AIRadarChart({ analysis }: AIRadarChartProps) {
  const data = [
    { dimension: 'Style', score: analysis.style_score ?? 0, fullMark: 10 },
    { dimension: 'Grammaire', score: analysis.grammar_score ?? 0, fullMark: 10 },
    { dimension: 'Narration', score: analysis.narrative_score ?? 0, fullMark: 10 },
    { dimension: 'Cohérence', score: analysis.coherence_score ?? 0, fullMark: 10 },
    { dimension: 'Personnages', score: analysis.characters_score ?? 0, fullMark: 10 },
    { dimension: 'Dialogues', score: analysis.dialogues_score ?? 0, fullMark: 10 },
    { dimension: 'Originalité', score: analysis.originality_score ?? 0, fullMark: 10 },
    { dimension: 'Public cible', score: analysis.target_fit_score ?? 0, fullMark: 10 },
  ]

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 12, fill: '#6b7280' }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 10]}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickCount={6}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#7c3aed"
          fill="#7c3aed"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value: number) => [`${value}/10`, 'Score']}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
