import Link from 'next/link'
import {
  BookOpen,
  PenTool,
  Star,
  Building2,
  Brain,
  Shield,
  ArrowRight,
  CheckCircle2,
  Users,
  TrendingUp,
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-gray-900">ManuscritPro</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Commencer gratuitement
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-24 px-4 text-center bg-gradient-to-b from-purple-50 to-white">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block bg-purple-100 text-purple-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
            ✨ Pré-lecture IA incluse
          </span>
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight mb-6">
            Votre manuscrit mérite
            <span className="text-primary"> les meilleures critiques</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Soumettez votre roman, obtenez une analyse IA approfondie, recueillez des critiques
            constructives de lecteurs passionnés, et connectez-vous avec des éditeurs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register?role=writer"
              className="inline-flex items-center justify-center gap-2 bg-primary text-white font-semibold px-8 py-4 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-purple-200"
            >
              <PenTool className="h-5 w-5" />
              Je suis écrivain
            </Link>
            <Link
              href="/register?role=reader"
              className="inline-flex items-center justify-center gap-2 bg-white text-gray-900 font-semibold px-8 py-4 rounded-xl border-2 border-gray-200 hover:border-primary hover:text-primary transition-all"
            >
              <BookOpen className="h-5 w-5" />
              Je suis lecteur
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-3 gap-8 text-center">
          {[
            { value: '10 000+', label: 'Manuscrits analysés' },
            { value: '50 000+', label: 'Critiques rédigées' },
            { value: '200+', label: 'Éditeurs partenaires' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-primary">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features - 3 profiles */}
      <section className="py-24 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Une plateforme pour chaque profil
          </h2>
          <p className="text-center text-gray-500 mb-16 max-w-xl mx-auto">
            Écrivains, lecteurs et éditeurs — chacun trouve sa place sur ManuscritPro.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Writer */}
            <div className="p-8 rounded-2xl border-2 border-purple-100 bg-purple-50">
              <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mb-6">
                <PenTool className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Espace Écrivain</h3>
              <ul className="space-y-3 text-gray-600 text-sm">
                {[
                  'Upload PDF jusqu\'à 10 Mo',
                  'Analyse IA sur 8 dimensions',
                  'Tableau de bord des critiques',
                  'Workflow de publication guidé',
                  'Réponses aux critiques',
                  'Soumission aux éditeurs',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register?role=writer"
                className="mt-6 block text-center bg-purple-600 text-white font-medium py-2.5 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Soumettre mon manuscrit
              </Link>
            </div>

            {/* Reader */}
            <div className="p-8 rounded-2xl border-2 border-blue-100 bg-blue-50">
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-6">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Espace Lecteur</h3>
              <ul className="space-y-3 text-gray-600 text-sm">
                {[
                  'Catalogue filtrable de manuscrits',
                  'Lecteur PDF protégé intégré',
                  'Notation sur 4 critères',
                  'Critique structurée guidée',
                  'Système de badges & gamification',
                  'Accès aux meilleures œuvres',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register?role=reader"
                className="mt-6 block text-center bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Découvrir les manuscrits
              </Link>
            </div>

            {/* Editor */}
            <div className="p-8 rounded-2xl border-2 border-amber-100 bg-amber-50">
              <div className="w-12 h-12 bg-amber-600 rounded-xl flex items-center justify-center mb-6">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Espace Éditeur</h3>
              <ul className="space-y-3 text-gray-600 text-sm">
                {[
                  'Catalogue des meilleurs manuscrits',
                  'Filtres avancés (note ≥ 4/5)',
                  'Manuscrits avec 20+ critiques',
                  'Messagerie directe auteurs',
                  'Téléchargement avec accord',
                  'Accès sur invitation',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register?role=editor"
                className="mt-6 block text-center bg-amber-600 text-white font-medium py-2.5 rounded-lg hover:bg-amber-700 transition-colors"
              >
                Accéder au catalogue
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* AI Feature */}
      <section className="py-24 px-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-6">
                <Brain className="h-4 w-4" />
                Intelligence Artificielle
              </div>
              <h2 className="text-3xl font-bold mb-6">
                Pré-lecture IA sur 8 dimensions
              </h2>
              <p className="text-purple-200 mb-8 leading-relaxed">
                Avant d'exposer votre manuscrit à la communauté, notre IA basée sur Claude Opus
                analyse en profondeur votre texte et génère un rapport détaillé.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  '✍️ Style & Fluidité',
                  '📝 Grammaire & Orthographe',
                  '🏗️ Construction narrative',
                  '🔗 Cohérence interne',
                  '👥 Personnages',
                  '💬 Dialogues',
                  '💡 Originalité',
                  '🎯 Public cible',
                ].map((dim) => (
                  <div key={dim} className="flex items-center gap-2 text-sm text-purple-100">
                    <span>{dim}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/10 rounded-2xl p-6 space-y-4">
              <div className="text-sm font-medium text-purple-200 mb-4">Exemple de rapport IA</div>
              {[
                { label: 'Style', score: 8 },
                { label: 'Grammaire', score: 9 },
                { label: 'Narration', score: 7 },
                { label: 'Cohérence', score: 8 },
                { label: 'Personnages', score: 9 },
                { label: 'Dialogues', score: 7 },
                { label: 'Originalité', score: 8 },
                { label: 'Public cible', score: 9 },
              ].map(({ label, score }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-xs text-purple-300 w-24">{label}</span>
                  <div className="flex-1 bg-white/10 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-400 to-indigo-400 h-2 rounded-full"
                      style={{ width: `${score * 10}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold w-6">{score}/10</span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between text-sm">
                  <span className="text-purple-300">Score global</span>
                  <span className="font-bold text-white">8.1 / 10</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Comment ça marche ?
          </h2>
          <p className="text-center text-gray-500 mb-16">
            De l'upload à l'éditeur en quelques étapes
          </p>
          <div className="grid md:grid-cols-5 gap-4 items-start">
            {[
              { step: '1', icon: '📤', title: 'Soumission', desc: 'Uploadez votre PDF avec métadonnées' },
              { step: '2', icon: '🤖', title: 'Analyse IA', desc: 'Claude analyse votre manuscrit sur 8 critères' },
              { step: '3', icon: '📖', title: 'Publication', desc: 'Votre œuvre rejoint le catalogue' },
              { step: '4', icon: '⭐', title: 'Critiques', desc: 'La communauté lit et note' },
              { step: '5', icon: '🏢', title: 'Éditeurs', desc: 'Les meilleures œuvres atteignent les éditeurs' },
            ].map((item, i) => (
              <div key={item.step} className="text-center relative">
                {i < 4 && (
                  <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-gray-200 z-0" />
                )}
                <div className="relative z-10 inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full text-2xl mb-3">
                  {item.icon}
                </div>
                <div className="text-xs font-bold text-primary mb-1">Étape {item.step}</div>
                <div className="font-semibold text-gray-900 mb-1">{item.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="py-16 px-4 bg-gray-50 border-t">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8 text-center">
          <div>
            <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 mb-2">Vos droits protégés</h3>
            <p className="text-sm text-gray-500">Vous restez l'unique propriétaire de votre œuvre. Aucune cession de droits.</p>
          </div>
          <div>
            <Users className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 mb-2">Communauté bienveillante</h3>
            <p className="text-sm text-gray-500">Critiques constructives modérées. Points forts et pistes d'amélioration.</p>
          </div>
          <div>
            <TrendingUp className="h-8 w-8 text-primary mx-auto mb-3" />
            <h3 className="font-bold text-gray-900 mb-2">Progression visible</h3>
            <p className="text-sm text-gray-500">Tableaux de bord détaillés pour suivre l'évolution de votre manuscrit.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Prêt à faire lire votre manuscrit ?
          </h2>
          <p className="text-gray-500 mb-8">
            Rejoignez des milliers d'écrivains qui ont amélioré leur œuvre grâce à ManuscritPro.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-10 py-4 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-purple-200 text-lg"
          >
            Créer mon compte gratuitement
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4 text-center text-sm text-gray-400">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="font-semibold text-gray-600">ManuscritPro</span>
        </div>
        <p>© {new Date().getFullYear()} ManuscritPro. Tous droits réservés.</p>
      </footer>
    </div>
  )
}
