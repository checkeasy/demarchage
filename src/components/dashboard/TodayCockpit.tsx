import Link from "next/link";
import {
  Users,
  MessageSquareReply,
  Clock,
  Phone,
  Flame,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface HotProspect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  status: string;
}

interface TodayCockpitProps {
  prospectsToContact: number;
  repliesToHandle: number;
  followUpsDue: number;
  activitiesDue: number;
  hotProspects: HotProspect[];
}

const COCKPIT_CARDS = [
  {
    key: "contact",
    label: "A contacter",
    icon: Users,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    href: "/prospects?status=active&pipeline_stage=to_contact",
  },
  {
    key: "replies",
    label: "Reponses",
    icon: MessageSquareReply,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    href: "/prospects?status=warm,hot",
  },
  {
    key: "followups",
    label: "Follow-ups",
    icon: Clock,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    href: "/campaigns",
  },
  {
    key: "activities",
    label: "Appels / RDV",
    icon: Phone,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    href: "/activities",
  },
] as const;

export function TodayCockpit({
  prospectsToContact,
  repliesToHandle,
  followUpsDue,
  activitiesDue,
  hotProspects,
}: TodayCockpitProps) {
  const values = {
    contact: prospectsToContact,
    replies: repliesToHandle,
    followups: followUpsDue,
    activities: activitiesDue,
  };

  const totalTasks = prospectsToContact + repliesToHandle + followUpsDue + activitiesDue;

  if (totalTasks === 0 && hotProspects.length === 0) return null;

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50/50 to-amber-50/30">
      <CardContent className="pt-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="size-5 text-orange-500" />
            <h3 className="font-semibold text-sm text-slate-900">
              Aujourd&apos;hui
            </h3>
          </div>
          <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
            {totalTasks} action{totalTasks > 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Counter cards grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {COCKPIT_CARDS.map((card) => {
            const Icon = card.icon;
            const count = values[card.key];
            return (
              <Link
                key={card.key}
                href={card.href}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-all hover:shadow-sm hover:-translate-y-0.5 bg-white ${
                  count > 0 ? card.borderColor : "border-slate-100"
                }`}
              >
                <div className={`flex items-center justify-center size-9 rounded-lg ${card.bgColor}`}>
                  <Icon className={`size-4 ${card.color}`} />
                </div>
                <div>
                  <p className={`text-xl font-bold tabular-nums ${count > 0 ? "text-slate-900" : "text-slate-400"}`}>
                    {count}
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {card.label}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Hot prospects list */}
        {hotProspects.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-orange-700 flex items-center gap-1">
                <Flame className="size-3" />
                Prospects chauds
              </p>
              <Link
                href="/prospects?status=hot,warm"
                className="text-[10px] text-orange-600 hover:underline flex items-center gap-0.5"
              >
                Voir tout <ArrowRight className="size-2.5" />
              </Link>
            </div>
            <div className="space-y-1">
              {hotProspects.map((p) => (
                <Link
                  key={p.id}
                  href={`/prospects/${p.id}`}
                  className="flex items-center justify-between gap-2 rounded-md bg-white border border-orange-100 px-3 py-2 hover:bg-orange-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    {p.company && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {p.company}
                      </p>
                    )}
                  </div>
                  <Badge
                    className={`text-[10px] shrink-0 ${
                      p.status === "hot"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {p.status === "hot" ? "Hot" : "Warm"}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
