export type UserRole = 'writer' | 'reader' | 'editor' | 'admin'
export type SubscriptionStatus = 'active' | 'inactive' | 'canceled' | 'past_due'
export type ManuscriptStatus = 'draft' | 'ai_review' | 'published' | 'community_validated' | 'submitted_editors'
export type ManuscriptVisibility = 'excerpt' | 'full'
export type ManuscriptGenre = 'roman' | 'polar' | 'sf' | 'fantasy' | 'jeunesse' | 'essai' | 'poesie' | 'biographie' | 'autre'
export type AIAnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type DownloadRequestStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  bio: string | null
  stripe_customer_id: string | null
  subscription_status: SubscriptionStatus
  total_reviews_given: number
  total_reads: number
  created_at: string
  updated_at: string
}

export interface Manuscript {
  id: string
  author_id: string
  title: string
  genre: ManuscriptGenre
  summary: string | null
  target_audience: string | null
  page_count: number | null
  word_count: number | null
  status: ManuscriptStatus
  visibility: ManuscriptVisibility
  pdf_storage_path: string | null
  excerpt_storage_path: string | null
  cover_storage_path: string | null
  average_rating: number
  total_reviews: number
  total_reads: number
  created_at: string
  updated_at: string
  // Joined
  author?: Profile
  ai_analysis?: AIAnalysis
  user_review?: Review
}

export interface Review {
  id: string
  manuscript_id: string
  reviewer_id: string
  style_rating: number
  originality_rating: number
  narrative_rating: number
  emotion_rating: number
  overall_rating: number
  strengths: string
  improvements: string
  author_reply: string | null
  author_reply_at: string | null
  created_at: string
  updated_at: string
  // Joined
  reviewer?: Profile
  manuscript?: Manuscript
}

export interface AIAnalysis {
  id: string
  manuscript_id: string
  style_score: number | null
  grammar_score: number | null
  narrative_score: number | null
  coherence_score: number | null
  characters_score: number | null
  dialogues_score: number | null
  originality_score: number | null
  target_fit_score: number | null
  overall_score: number | null
  style_feedback: string | null
  grammar_feedback: string | null
  grammar_errors: GrammarError[]
  narrative_feedback: string | null
  coherence_feedback: string | null
  characters_feedback: string | null
  dialogues_feedback: string | null
  originality_feedback: string | null
  target_fit_feedback: string | null
  global_summary: string | null
  key_strengths: string[]
  key_improvements: string[]
  report_pdf_path: string | null
  status: AIAnalysisStatus
  error_message: string | null
  chunks_analyzed: number
  total_chunks: number
  created_at: string
  updated_at: string
}

export interface GrammarError {
  type: string
  example: string
  count: number
}

export interface Badge {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string
  criteria_type: string
  criteria_value: number
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
  badge?: Badge
}

export interface Message {
  id: string
  sender_id: string
  recipient_id: string
  manuscript_id: string | null
  subject: string
  content: string
  read_at: string | null
  created_at: string
  sender?: Profile
  recipient?: Profile
  manuscript?: Manuscript
}

export interface DownloadRequest {
  id: string
  editor_id: string
  manuscript_id: string
  status: DownloadRequestStatus
  message: string | null
  created_at: string
  updated_at: string
  editor?: Profile
  manuscript?: Manuscript
}

export interface ManuscriptRead {
  id: string
  manuscript_id: string
  reader_id: string | null
  created_at: string
}

// AI Analysis dimension labels in French
export const AI_DIMENSIONS = [
  { key: 'style_score', label: 'Style', feedbackKey: 'style_feedback' },
  { key: 'grammar_score', label: 'Grammaire', feedbackKey: 'grammar_feedback' },
  { key: 'narrative_score', label: 'Narration', feedbackKey: 'narrative_feedback' },
  { key: 'coherence_score', label: 'Cohérence', feedbackKey: 'coherence_feedback' },
  { key: 'characters_score', label: 'Personnages', feedbackKey: 'characters_feedback' },
  { key: 'dialogues_score', label: 'Dialogues', feedbackKey: 'dialogues_feedback' },
  { key: 'originality_score', label: 'Originalité', feedbackKey: 'originality_feedback' },
  { key: 'target_fit_score', label: 'Public cible', feedbackKey: 'target_fit_feedback' },
] as const

export const GENRE_LABELS: Record<ManuscriptGenre, string> = {
  roman: 'Roman',
  polar: 'Polar',
  sf: 'Science-Fiction',
  fantasy: 'Fantasy',
  jeunesse: 'Jeunesse',
  essai: 'Essai',
  poesie: 'Poésie',
  biographie: 'Biographie',
  autre: 'Autre',
}

export const STATUS_LABELS: Record<ManuscriptStatus, string> = {
  draft: 'Brouillon',
  ai_review: 'Pré-lecture IA',
  published: 'Publié',
  community_validated: 'Validé communauté',
  submitted_editors: 'Soumis aux éditeurs',
}

export const STATUS_COLORS: Record<ManuscriptStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  ai_review: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  community_validated: 'bg-purple-100 text-purple-700',
  submitted_editors: 'bg-amber-100 text-amber-700',
}
