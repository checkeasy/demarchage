"use client";

import Link from "next/link";
import { ArrowRight, Clock, CalendarCheck, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ActivitySummaryCardProps {
  overdue: number;
  dueToday: number;
  completedThisWeek: number;
}

export function ActivitySummaryCard({
  overdue,
  dueToday,
  completedThisWeek,
}: ActivitySummaryCardProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">Activites</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-red-500" />
              <span className="text-sm">En retard</span>
            </div>
            <Badge variant="destructive" className="min-w-[2rem] justify-center">
              {overdue}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck className="size-4 text-blue-500" />
              <span className="text-sm">Aujourd&apos;hui</span>
            </div>
            <Badge className="min-w-[2rem] justify-center bg-blue-100 text-blue-700 hover:bg-blue-100">
              {dueToday}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-green-500" />
              <span className="text-sm">Terminees cette semaine</span>
            </div>
            <Badge className="min-w-[2rem] justify-center bg-green-100 text-green-700 hover:bg-green-100">
              {completedThisWeek}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="w-full">
          <Link href="/activities">
            Voir les activites
            <ArrowRight className="size-4 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
