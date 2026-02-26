import Link from "next/link";
import {
  Mail,
  Eye,
  MousePointerClick,
  Reply,
  AlertTriangle,
  Plus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const stats = [
  {
    label: "Emails envoyes",
    value: "0",
    icon: Mail,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    label: "Taux d'ouverture",
    value: "0%",
    icon: Eye,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    label: "Taux de clic",
    value: "0%",
    icon: MousePointerClick,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    label: "Taux de reponse",
    value: "0%",
    icon: Reply,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    label: "Taux de bounce",
    value: "0%",
    icon: AlertTriangle,
    color: "text-red-600",
    bgColor: "bg-red-50",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Tableau de bord</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vue d&apos;ensemble de vos campagnes de prospection
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-lg ${stat.bgColor}`}
                  >
                    <Icon className={`size-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-2">
            <Mail className="size-8 text-slate-400" />
          </div>
          <CardTitle>Aucune campagne</CardTitle>
          <CardDescription>
            Creez votre premiere campagne pour commencer a prospecter et suivre
            vos resultats ici.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-6">
          <Button asChild>
            <Link href="/campaigns/new">
              <Plus className="size-4" />
              Creer une campagne
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
