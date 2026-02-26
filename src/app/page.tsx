import Link from "next/link";
import { Zap, Mail, Linkedin, BarChart3, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold">ColdReach</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost">Se connecter</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Commencer gratuitement</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-blue-50 px-4 py-1.5 text-sm text-blue-700">
            <Zap className="h-4 w-4" />
            Plateforme de cold outreach multi-canal
          </div>
          <h1 className="max-w-3xl text-5xl font-bold tracking-tight text-gray-900">
            Automatisez votre prospection{" "}
            <span className="text-blue-600">email et LinkedIn</span>
          </h1>
          <p className="max-w-2xl text-lg text-gray-600">
            Creez des sequences multi-etapes, personnalisez chaque message,
            suivez les ouvertures et les clics, et centralisez toutes vos
            reponses dans une boite de reception unifiee.
          </p>
          <div className="flex gap-4">
            <Link href="/auth/register">
              <Button size="lg" className="gap-2">
                Demarrer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="border-t bg-gray-50 py-24">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
              Tout ce dont vous avez besoin pour prospecter
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="rounded-xl border bg-white p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  Sequences email
                </h3>
                <p className="text-gray-600">
                  Creez des sequences multi-etapes avec des delais
                  personnalises. A/B testez vos objets et contenus.
                </p>
              </div>
              <div className="rounded-xl border bg-white p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                  <Linkedin className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  Outreach LinkedIn
                </h3>
                <p className="text-gray-600">
                  Combinez email et LinkedIn dans vos sequences. File de taches
                  pour les actions manuelles.
                </p>
              </div>
              <div className="rounded-xl border bg-white p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">
                  Analytics en temps reel
                </h3>
                <p className="text-gray-600">
                  Suivez les ouvertures, clics et reponses. Dashboard complet
                  avec metriques detaillees.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Zap className="h-4 w-4" />
            ColdReach
          </div>
          <p className="text-sm text-gray-500">
            2026 ColdReach. Tous droits reserves.
          </p>
        </div>
      </footer>
    </div>
  );
}
