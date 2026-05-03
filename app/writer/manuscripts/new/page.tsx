'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { GENRE_LABELS } from '@/lib/types'
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  Brain,
} from 'lucide-react'

type UploadStep = 'form' | 'uploading' | 'analyzing' | 'done'

export default function NewManuscriptPage() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [step, setStep] = useState<UploadStep>('form')
  const [form, setForm] = useState({
    title: '',
    genre: '',
    summary: '',
    target_audience: '',
    page_count: '',
    visibility: 'excerpt',
  })
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast({ title: 'Format invalide', description: 'Seuls les fichiers PDF sont acceptés', variant: 'destructive' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Fichier trop grand', description: 'La taille maximale est de 10 Mo', variant: 'destructive' })
      return
    }
    setPdfFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const isFormValid = form.title && form.genre && pdfFile

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) return

    setStep('uploading')

    try {
      // 1. Upload PDF
      const uploadFormData = new FormData()
      uploadFormData.append('file', pdfFile!)
      uploadFormData.append('type', 'manuscript')

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error ?? 'Erreur d\'upload')
      }

      const { storagePath } = await uploadRes.json()

      // 2. Create manuscript record
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { data: manuscript, error: insertError } = await supabase
        .from('manuscripts')
        .insert({
          author_id: user.id,
          title: form.title,
          genre: form.genre,
          summary: form.summary || null,
          target_audience: form.target_audience || null,
          page_count: form.page_count ? parseInt(form.page_count) : null,
          visibility: form.visibility,
          pdf_storage_path: storagePath,
          status: 'draft',
        })
        .select()
        .single()

      if (insertError || !manuscript) throw new Error(insertError?.message ?? 'Erreur de création')

      // 3. Trigger AI analysis
      setStep('analyzing')

      const analysisRes = await fetch(`/api/manuscripts/${manuscript.id}/ai-analysis`, {
        method: 'POST',
      })

      if (!analysisRes.ok) {
        const err = await analysisRes.json()
        throw new Error(err.error ?? 'Erreur d\'analyse')
      }

      setStep('done')
      toast({ title: 'Manuscrit soumis !', description: 'L\'analyse IA est en cours.' })

      setTimeout(() => {
        router.push(`/writer/manuscripts/${manuscript.id}`)
      }, 2000)

    } catch (err: unknown) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Une erreur est survenue',
        variant: 'destructive',
      })
      setStep('form')
    }
  }

  if (step === 'uploading' || step === 'analyzing' || step === 'done') {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md text-center">
          <CardContent className="py-12">
            {step === 'done' ? (
              <>
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">Manuscrit soumis !</h2>
                <p className="text-muted-foreground">Redirection en cours…</p>
              </>
            ) : (
              <>
                {step === 'analyzing' ? (
                  <Brain className="h-16 w-16 text-purple-500 mx-auto mb-4 animate-pulse" />
                ) : (
                  <Loader2 className="h-16 w-16 text-primary mx-auto mb-4 animate-spin" />
                )}
                <h2 className="text-xl font-bold mb-2">
                  {step === 'uploading' ? 'Upload en cours…' : 'Analyse IA en cours…'}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {step === 'uploading'
                    ? 'Envoi de votre PDF vers nos serveurs…'
                    : 'Claude Opus analyse votre manuscrit sur 8 dimensions. Cela peut prendre quelques minutes.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Soumettre un manuscrit</h1>
        <p className="text-muted-foreground">
          Votre manuscrit sera analysé par notre IA avant d'être publié dans la communauté
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* PDF Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fichier PDF</CardTitle>
            <CardDescription>Format PDF uniquement, taille maximale 10 Mo</CardDescription>
          </CardHeader>
          <CardContent>
            {pdfFile ? (
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                <FileText className="h-8 w-8 text-green-600" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-green-900 truncate">{pdfFile.name}</div>
                  <div className="text-xs text-green-700">
                    {(pdfFile.size / 1024 / 1024).toFixed(2)} Mo
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPdfFile(null)}
                  className="text-green-600 hover:text-green-800"
                >
                  Changer
                </button>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('pdf-input')?.click()}
              >
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  Glissez-déposez votre PDF ici
                </p>
                <p className="text-xs text-muted-foreground mt-1">ou cliquez pour parcourir</p>
                <input
                  id="pdf-input"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Métadonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titre <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Titre de votre manuscrit"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Genre <span className="text-red-500">*</span></Label>
                <Select
                  value={form.genre}
                  onValueChange={(v) => setForm((f) => ({ ...f, genre: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un genre" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GENRE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="page_count">Nombre de pages</Label>
                <Input
                  id="page_count"
                  type="number"
                  min={1}
                  value={form.page_count}
                  onChange={(e) => setForm((f) => ({ ...f, page_count: e.target.value }))}
                  placeholder="250"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_audience">Public cible</Label>
              <Input
                id="target_audience"
                value={form.target_audience}
                onChange={(e) => setForm((f) => ({ ...f, target_audience: e.target.value }))}
                placeholder="ex: Adultes 25-45 ans, amateurs de thriller"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">
                Résumé{' '}
                <span className={`text-xs ${form.summary.length > 500 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  ({form.summary.length}/500)
                </span>
              </Label>
              <Textarea
                id="summary"
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Résumé de votre manuscrit (max. 500 caractères)"
                rows={4}
                maxLength={500}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Visibilité</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'excerpt', label: 'Extrait (3 premiers chapitres)', desc: 'Accès gratuit à un extrait' },
                  { value: 'full', label: 'Manuscrit complet', desc: 'Tout le manuscrit accessible' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, visibility: opt.value }))}
                    className={`p-3 rounded-lg border-2 text-left text-sm transition-all ${
                      form.visibility === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI info */}
        <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <Brain className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <div className="font-medium text-purple-900">Analyse IA automatique</div>
            <div className="text-purple-700 mt-1">
              Après soumission, Claude Opus analysera votre manuscrit sur 8 dimensions (style, grammaire,
              narration, cohérence, personnages, dialogues, originalité, public cible) avant publication.
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={!isFormValid} className="flex-1">
            Soumettre le manuscrit
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Annuler
          </Button>
        </div>
      </form>
    </div>
  )
}
