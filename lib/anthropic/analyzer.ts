import Anthropic from '@anthropic-ai/sdk'
import type { AIAnalysis, GrammarError } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CHUNK_SIZE = 30000 // ~8000 tokens in chars

interface ChunkAnalysis {
  style: { score: number; feedback: string; examples: string[] }
  grammar: { score: number; feedback: string; recurring_errors: GrammarError[] }
  narrative: { score: number; feedback: string }
  coherence: { score: number; feedback: string }
  characters: { score: number; feedback: string }
  dialogues: { score: number; feedback: string }
  originality: { score: number; feedback: string }
  target_fit: { score: number; feedback: string }
  overall_summary: string
  key_strengths: string[]
  key_improvements: string[]
}

function splitIntoChunks(text: string): string[] {
  // Try to split on chapter boundaries
  const chapterRegex = /(?:chapitre|chapter|partie|part)\s+(?:\d+|[ivxlcdm]+|[a-z]+)/gi
  const matches = [...text.matchAll(chapterRegex)]

  if (matches.length >= 2) {
    const chunks: string[] = []
    let lastIndex = 0

    for (const match of matches) {
      if (match.index && match.index > lastIndex) {
        const segment = text.slice(lastIndex, match.index)
        // Sub-chunk large chapters
        for (let i = 0; i < segment.length; i += CHUNK_SIZE) {
          const chunk = segment.slice(i, i + CHUNK_SIZE)
          if (chunk.trim().length > 200) chunks.push(chunk)
        }
        lastIndex = match.index
      }
    }
    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex)
      for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
        const chunk = remaining.slice(i, i + CHUNK_SIZE)
        if (chunk.trim().length > 200) chunks.push(chunk)
      }
    }
    if (chunks.length > 0) return chunks
  }

  // Fallback: split by size
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    const chunk = text.slice(i, i + CHUNK_SIZE)
    if (chunk.trim().length > 200) chunks.push(chunk)
  }
  return chunks
}

async function analyzeChunk(
  chunk: string,
  chunkIndex: number,
  totalChunks: number,
  genre: string,
  targetAudience: string
): Promise<ChunkAnalysis> {
  const prompt = `Tu es un expert en critique littéraire. Analyse cet extrait de manuscrit (extrait ${chunkIndex + 1}/${totalChunks}).
Genre: ${genre} | Public cible: ${targetAudience}

Évalue chacune des 8 dimensions sur 10 et donne un retour détaillé en français.

EXTRAIT:
---
${chunk.slice(0, 25000)}
---

Réponds UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "style": {"score": 0, "feedback": "...", "examples": ["..."]},
  "grammar": {"score": 0, "feedback": "...", "recurring_errors": [{"type": "...", "example": "...", "count": 1}]},
  "narrative": {"score": 0, "feedback": "..."},
  "coherence": {"score": 0, "feedback": "..."},
  "characters": {"score": 0, "feedback": "..."},
  "dialogues": {"score": 0, "feedback": "..."},
  "originality": {"score": 0, "feedback": "..."},
  "target_fit": {"score": 0, "feedback": "..."},
  "overall_summary": "...",
  "key_strengths": ["...", "...", "..."],
  "key_improvements": ["...", "...", "..."]
}`

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Invalid AI response format')

  return JSON.parse(jsonMatch[0]) as ChunkAnalysis
}

function aggregateAnalyses(analyses: ChunkAnalysis[]): Omit<AIAnalysis,
  'id' | 'manuscript_id' | 'report_pdf_path' | 'status' | 'error_message' | 'chunks_analyzed' | 'total_chunks' | 'created_at' | 'updated_at'
> {
  const avg = (key: keyof ChunkAnalysis) =>
    Math.round(
      analyses.reduce((sum, a) => sum + ((a[key] as { score: number }).score || 0), 0) / analyses.length
    )

  const collectFeedback = (key: keyof ChunkAnalysis) =>
    analyses
      .map((a, i) => `[Extrait ${i + 1}] ${(a[key] as { feedback: string }).feedback}`)
      .join('\n\n')

  const allStrengths = analyses.flatMap((a) => a.key_strengths)
  const allImprovements = analyses.flatMap((a) => a.key_improvements)
  const allGrammarErrors = analyses.flatMap((a) => a.grammar.recurring_errors || [])

  // Deduplicate and limit
  const uniqueStrengths = [...new Set(allStrengths)].slice(0, 5)
  const uniqueImprovements = [...new Set(allImprovements)].slice(0, 5)

  // Aggregate grammar errors
  const grammarMap = new Map<string, GrammarError>()
  for (const err of allGrammarErrors) {
    const existing = grammarMap.get(err.type)
    if (existing) {
      existing.count += err.count
    } else {
      grammarMap.set(err.type, { ...err })
    }
  }
  const grammarErrors = [...grammarMap.values()].sort((a, b) => b.count - a.count).slice(0, 10)

  const scores = {
    style_score: avg('style'),
    grammar_score: avg('grammar'),
    narrative_score: avg('narrative'),
    coherence_score: avg('coherence'),
    characters_score: avg('characters'),
    dialogues_score: avg('dialogues'),
    originality_score: avg('originality'),
    target_fit_score: avg('target_fit'),
  }

  const overallScore = parseFloat(
    (Object.values(scores).reduce((a, b) => a + b, 0) / 8).toFixed(2)
  )

  return {
    ...scores,
    overall_score: overallScore,
    style_feedback: collectFeedback('style'),
    grammar_feedback: collectFeedback('grammar'),
    grammar_errors: grammarErrors,
    narrative_feedback: collectFeedback('narrative'),
    coherence_feedback: collectFeedback('coherence'),
    characters_feedback: collectFeedback('characters'),
    dialogues_feedback: collectFeedback('dialogues'),
    originality_feedback: collectFeedback('originality'),
    target_fit_feedback: collectFeedback('target_fit'),
    global_summary: analyses[Math.floor(analyses.length / 2)].overall_summary,
    key_strengths: uniqueStrengths,
    key_improvements: uniqueImprovements,
  }
}

export async function analyzeManuscript(
  text: string,
  genre: string,
  targetAudience: string,
  onProgress?: (done: number, total: number) => void
): Promise<ReturnType<typeof aggregateAnalyses>> {
  const chunks = splitIntoChunks(text)
  const totalChunks = chunks.length

  // For large manuscripts, sample strategically: first, last, and evenly spaced middle chunks
  let chunksToAnalyze: { chunk: string; originalIndex: number }[]

  if (totalChunks <= 5) {
    chunksToAnalyze = chunks.map((chunk, i) => ({ chunk, originalIndex: i }))
  } else {
    const indices = new Set<number>([0, totalChunks - 1])
    const step = Math.floor(totalChunks / 4)
    for (let i = step; i < totalChunks - 1; i += step) indices.add(i)
    chunksToAnalyze = [...indices].sort((a, b) => a - b).map((i) => ({ chunk: chunks[i], originalIndex: i }))
  }

  const analyses: ChunkAnalysis[] = []

  for (let i = 0; i < chunksToAnalyze.length; i++) {
    const { chunk, originalIndex } = chunksToAnalyze[i]
    const analysis = await analyzeChunk(chunk, originalIndex, totalChunks, genre, targetAudience || 'grand public')
    analyses.push(analysis)
    onProgress?.(i + 1, chunksToAnalyze.length)
  }

  return aggregateAnalyses(analyses)
}

export function chunkCount(text: string): number {
  return splitIntoChunks(text).length
}
