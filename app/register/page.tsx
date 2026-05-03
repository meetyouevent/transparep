'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, Loader2, Eye, EyeOff, PenTool, BookOpenCheck, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/types'

const ROLES: { value: UserRole; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'writer',
    label: 'Écrivain',
    description: 'Soumettez et faites critiquer vos manuscrits',
    icon: <PenTool className="h-5 w-5" />,
  },
  {
    value: 'reader',
    label: 'Lecteur',
    description: 'Lisez et critiquez des manuscrits inédits',
    icon: <BookOpenCheck className="h-5 w-5" />,
  },
  {
    value: 'editor',
    label: 'Éditeur',
    description: 'Découvrez les meilleurs manuscrits validés',
    icon: <Building2 className="h-5 w-5" />,
  },
]

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = createClient()

  const defaultRole = (searchParams.get('role') as UserRole) ?? 'reader'
  const [selectedRole, setSelectedRole] = useState<UserRole>(defaultRole)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      toast({
        title: 'Mot de passe trop court',
        description: 'Le mot de passe doit faire au moins 8 caractères',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: selectedRole,
          },
        },
      })

      if (error) throw error

      toast({
        title: 'Compte créé !',
        description: 'Vérifiez votre email pour confirmer votre inscription.',
      })

      // Redirect based on role
      const dashboardMap: Record<UserRole, string> = {
        writer: '/writer',
        reader: '/reader',
        editor: '/editor',
        admin: '/writer',
      }
      router.push(dashboardMap[selectedRole])
      router.refresh()
    } catch (err: unknown) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible de créer le compte',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <BookOpen className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-gray-900">ManuscritPro</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Créer un compte</CardTitle>
            <CardDescription>Rejoignez la communauté ManuscritPro</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-5">
              {/* Role selector */}
              <div className="space-y-2">
                <Label>Je suis…</Label>
                <div className="grid grid-cols-3 gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setSelectedRole(r.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-lg border-2 text-center transition-all',
                        selectedRole === r.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      )}
                    >
                      {r.icon}
                      <span className="text-xs font-medium">{r.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {ROLES.find((r) => r.value === selectedRole)?.description}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jean Dupont"
                  required
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8 caractères minimum"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Création du compte…</>
                ) : (
                  'Créer mon compte'
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                En créant un compte, vous acceptez nos{' '}
                <Link href="/cgu" className="text-primary hover:underline">
                  Conditions d'utilisation
                </Link>
              </p>
            </form>

            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">Déjà un compte ? </span>
              <Link href="/login" className="text-primary hover:underline font-medium">
                Se connecter
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
