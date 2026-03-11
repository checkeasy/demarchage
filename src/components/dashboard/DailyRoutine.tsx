import Link from "next/link";
import {
  Users,
  MessageSquareReply,
  Clock,
  Phone,
  Flame,
  ArrowRight,
  MapPin,
  Mail,
  MessageSquare,
  Linkedin,
  CheckCircle2,
  Map,
  Globe,
  Zap,
  Layers,
  Newspaper,
  AlertCircle,
  Target,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

// --- Types ---

interface HotProspect {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  status: string;
}

interface DailyGoal {
  label: string;
  current: number;
  target: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  progressColor: string;
}

interface SuggestedZone {
  country: string;
  city?: string;
}

interface RoutingBucketData {
  key: string;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  count: number;
  href: string;
}

interface ActiveMission {
  id: string;
  name: string;
  language: string;
  total_prospects: number;
  total_enrolled: number;
  total_sent: number;
  total_replied: number;
  search_keywords: string[];
}

interface DailyRoutineProps {
  // Daily progress
  scrapedToday: number;
  emailsSentToday: number;
  repliesToday: number;
  linkedinConnectionsToday: number;
  // Streak
  streakDays: number;
  // Suggested zones
  suggestedZones: SuggestedZone[];
  // Smart routing
  routingBuckets: RoutingBucketData[];
  totalUnrouted: number;
  languageCounts: { fr: number; es: number; en: number };
  // Cockpit (existing)
  prospectsToContact: number;
  repliesToHandle: number;
  followUpsDue: number;
  activitiesDue: number;
  hotProspects: HotProspect[];
  // Active missions
  activeMissions: ActiveMission[];
}

// --- Daily goals config ---
const DAILY_TARGETS = {
  scraped: 20,
  emails: 15,
  replies: 5,
  linkedin: 10,
};

// --- Cockpit cards (same as before) ---
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

// --- Tourist destinations for suggestions ---
const TOURIST_DESTINATIONS: SuggestedZone[] = [
  { country: "France", city: "Paris" },
  { country: "France", city: "Nice" },
  { country: "France", city: "Lyon" },
  { country: "Spain", city: "Barcelona" },
  { country: "Spain", city: "Madrid" },
  { country: "Spain", city: "Malaga" },
  { country: "Italy", city: "Rome" },
  { country: "Italy", city: "Milan" },
  { country: "Italy", city: "Florence" },
  { country: "Portugal", city: "Lisbon" },
  { country: "Portugal", city: "Porto" },
  { country: "Greece", city: "Athens" },
  { country: "Greece", city: "Santorini" },
  { country: "Croatia", city: "Dubrovnik" },
  { country: "Thailand", city: "Bangkok" },
  { country: "Thailand", city: "Phuket" },
  { country: "Mexico", city: "Cancun" },
  { country: "Mexico", city: "Mexico City" },
  { country: "Morocco", city: "Marrakech" },
  { country: "United Kingdom", city: "London" },
  { country: "Germany", city: "Berlin" },
  { country: "Netherlands", city: "Amsterdam" },
  { country: "Japan", city: "Tokyo" },
  { country: "Australia", city: "Sydney" },
  { country: "United States", city: "Miami" },
  { country: "United States", city: "New York" },
  { country: "Brazil", city: "Rio de Janeiro" },
  { country: "Turkey", city: "Istanbul" },
  { country: "Indonesia", city: "Bali" },
  { country: "UAE", city: "Dubai" },
];

const BUCKET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  email_linkedin: Layers,
  email_only: Mail,
  linkedin_only: Linkedin,
  phone_whatsapp: Phone,
  newsletter: Newspaper,
  incomplete: AlertCircle,
};

export function DailyRoutine({
  scrapedToday,
  emailsSentToday,
  repliesToday,
  linkedinConnectionsToday,
  streakDays,
  suggestedZones,
  routingBuckets,
  totalUnrouted,
  languageCounts,
  prospectsToContact,
  repliesToHandle,
  followUpsDue,
  activitiesDue,
  hotProspects,
  activeMissions,
}: DailyRoutineProps) {
  const goals: DailyGoal[] = [
    {
      label: "Prospects scrappes",
      current: scrapedToday,
      target: DAILY_TARGETS.scraped,
      icon: MapPin,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      progressColor: "bg-blue-500",
    },
    {
      label: "Emails envoyes",
      current: emailsSentToday,
      target: DAILY_TARGETS.emails,
      icon: Mail,
      color: "text-green-600",
      bgColor: "bg-green-50",
      progressColor: "bg-green-500",
    },
    {
      label: "Reponses traitees",
      current: repliesToday,
      target: DAILY_TARGETS.replies,
      icon: MessageSquare,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      progressColor: "bg-amber-500",
    },
    {
      label: "Connexions LinkedIn",
      current: linkedinConnectionsToday,
      target: DAILY_TARGETS.linkedin,
      icon: Linkedin,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      progressColor: "bg-purple-500",
    },
  ];

  const completedGoals = goals.filter((g) => g.current >= g.target).length;
  const cockpitValues = {
    contact: prospectsToContact,
    replies: repliesToHandle,
    followups: followUpsDue,
    activities: activitiesDue,
  };
  const totalCockpitTasks = prospectsToContact + repliesToHandle + followUpsDue + activitiesDue;

  // Pick 2 suggested zones (prefer ones from suggestedZones, fallback to random destinations)
  const mapZone = suggestedZones[0] || TOURIST_DESTINATIONS[Math.floor(Math.random() * TOURIST_DESTINATIONS.length)];
  const linkedinZone = suggestedZones[1] || TOURIST_DESTINATIONS[Math.floor(Math.random() * TOURIST_DESTINATIONS.length)];

  return (
    <Card className="border-orange-200 bg-gradient-to-br from-orange-50/50 to-amber-50/30">
      <CardContent className="pt-5 space-y-5">
        {/* Section 1 — Header with streak */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="size-5 text-orange-500" />
            <h3 className="font-semibold text-sm text-slate-900">
              Ma routine du jour
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {completedGoals === 4 && (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                Objectifs atteints !
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-xs font-semibold ${
                streakDays >= 7
                  ? "border-green-300 text-green-700 bg-green-50"
                  : "border-orange-200 text-orange-700 bg-orange-50"
              }`}
            >
              <Flame className="size-3 mr-1" />
              Jour {streakDays}
            </Badge>
          </div>
        </div>

        {/* Section 2 — Progress bars (2x2 grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {goals.map((goal) => {
            const Icon = goal.icon;
            const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
            const done = goal.current >= goal.target;

            return (
              <div
                key={goal.label}
                className={`rounded-lg border p-3 bg-white ${
                  done ? "border-green-200" : "border-slate-150"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center justify-center size-7 rounded-md ${goal.bgColor}`}>
                      <Icon className={`size-3.5 ${goal.color}`} />
                    </div>
                    <span className="text-xs font-medium text-slate-700">{goal.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-bold tabular-nums ${done ? "text-green-600" : "text-slate-900"}`}>
                      {goal.current}/{goal.target}
                    </span>
                    {done && <CheckCircle2 className="size-4 text-green-500" />}
                  </div>
                </div>
                <div className="relative h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                      done ? "bg-green-500" : goal.progressColor
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 text-right">{pct}%</p>
              </div>
            );
          })}
        </div>

        {/* Section 3 — Action buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/maps-scraper" className="block">
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 hover:bg-blue-100/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center size-10 rounded-xl bg-blue-100">
                  <Map className="size-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Scraper Google Maps</p>
                  <p className="text-[10px] text-blue-600">Trouver des conciergeries</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-100/60 rounded-md px-2.5 py-1.5">
                <Globe className="size-3" />
                <span>
                  Zone suggeree : <strong>{mapZone.city ? `${mapZone.city}, ${mapZone.country}` : mapZone.country}</strong>
                </span>
              </div>
            </div>
          </Link>

          <Link href="/scraper" className="block">
            <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 hover:bg-purple-100/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center size-10 rounded-xl bg-purple-100">
                  <Linkedin className="size-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-purple-900">Scraper LinkedIn</p>
                  <p className="text-[10px] text-purple-600">Enrichir vos contacts</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-purple-700 bg-purple-100/60 rounded-md px-2.5 py-1.5">
                <Globe className="size-3" />
                <span>
                  Zone suggeree : <strong>{linkedinZone.city ? `${linkedinZone.city}, ${linkedinZone.country}` : linkedinZone.country}</strong>
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Section 3.25 — Active Missions */}
        {activeMissions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-indigo-500" />
                <p className="text-xs font-semibold text-slate-700">
                  Missions actives
                </p>
              </div>
              <Link href="/missions" className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5">
                Voir tout <ArrowRight className="size-2.5" />
              </Link>
            </div>
            <div className="space-y-2">
              {activeMissions.map((mission) => {
                const pct = mission.total_prospects > 0
                  ? Math.round((mission.total_enrolled / mission.total_prospects) * 100)
                  : 0;
                return (
                  <div key={mission.id} className="rounded-lg border border-indigo-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{mission.name}</p>
                        <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700">
                          {mission.language.toUpperCase()}
                        </Badge>
                      </div>
                      <Link href={`/maps-scraper?mission_id=${mission.id}`}>
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          <Map className="size-3 mr-1" />
                          Scraper
                        </Button>
                      </Link>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span>{mission.total_prospects} prospects</span>
                      <span>{mission.total_enrolled} inscrits</span>
                      <span>{mission.total_sent} envoyes</span>
                      <span>{mission.total_replied} reponses</span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 3.5 — Smart Routing */}
        {totalUnrouted > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="size-4 text-indigo-500" />
                <p className="text-xs font-semibold text-slate-700">
                  Smart Routing
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Language badges */}
                {languageCounts.fr > 0 && (
                  <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700">
                    FR {languageCounts.fr}
                  </Badge>
                )}
                {languageCounts.es > 0 && (
                  <Badge variant="outline" className="text-[10px] border-orange-200 text-orange-700">
                    ES {languageCounts.es}
                  </Badge>
                )}
                {languageCounts.en > 0 && (
                  <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-700">
                    EN {languageCounts.en}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-700">
                  {totalUnrouted} a router
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {routingBuckets.map((bucket) => {
                const Icon = BUCKET_ICONS[bucket.key] || Mail;
                const isEmpty = bucket.count === 0;

                return (
                  <Link
                    key={bucket.key}
                    href={bucket.href}
                    className={`rounded-lg border p-3 transition-all bg-white ${
                      isEmpty
                        ? "border-slate-100 opacity-40 pointer-events-none"
                        : `${bucket.borderColor} hover:shadow-sm hover:-translate-y-0.5`
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`flex items-center justify-center size-8 rounded-lg ${bucket.bgColor}`}>
                        <Icon className={`size-4 ${bucket.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-slate-700 truncate">
                            {bucket.label}
                          </p>
                          <span className={`text-sm font-bold tabular-nums ${
                            isEmpty ? "text-slate-300" : "text-slate-900"
                          }`}>
                            {bucket.count}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {bucket.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 4 — Actions en attente */}
        {totalCockpitTasks > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-600">A traiter aujourd&apos;hui</p>
              <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
                {totalCockpitTasks} action{totalCockpitTasks > 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {COCKPIT_CARDS.map((card) => {
                const Icon = card.icon;
                const count = cockpitValues[card.key];
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
          </div>
        )}

        {/* Hot prospects */}
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
