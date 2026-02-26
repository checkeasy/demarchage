"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_SENDING_WINDOW } from "@/lib/constants";

const TIMEZONES = [
  { value: "Europe/Paris", label: "Europe/Paris (CET)" },
  { value: "Europe/London", label: "Europe/London (GMT)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
  { value: "Europe/Madrid", label: "Europe/Madrid (CET)" },
  { value: "Europe/Rome", label: "Europe/Rome (CET)" },
  { value: "Europe/Brussels", label: "Europe/Brussels (CET)" },
  { value: "Europe/Zurich", label: "Europe/Zurich (CET)" },
  { value: "Europe/Amsterdam", label: "Europe/Amsterdam (CET)" },
  { value: "Europe/Lisbon", label: "Europe/Lisbon (WET)" },
  { value: "America/New_York", label: "America/New_York (EST)" },
  { value: "America/Chicago", label: "America/Chicago (CST)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST)" },
];

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2)
    .toString()
    .padStart(2, "0");
  const minutes = i % 2 === 0 ? "00" : "30";
  return `${hours}:${minutes}`;
});

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];

export interface ScheduleData {
  timezone: string;
  sending_window_start: string;
  sending_window_end: string;
  sending_days: number[];
  daily_limit: number;
}

interface ScheduleConfigProps {
  value: ScheduleData;
  onChange: (value: ScheduleData) => void;
}

export function ScheduleConfig({ value, onChange }: ScheduleConfigProps) {
  const handleDayToggle = (day: number, checked: boolean) => {
    const newDays = checked
      ? [...value.sending_days, day].sort((a, b) => a - b)
      : value.sending_days.filter((d) => d !== day);
    onChange({ ...value, sending_days: newDays });
  };

  return (
    <div className="space-y-6">
      {/* Timezone */}
      <div className="space-y-2">
        <Label>Fuseau horaire</Label>
        <Select
          value={value.timezone}
          onValueChange={(tz) => onChange({ ...value, timezone: tz })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selectionner un fuseau horaire" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Business hours */}
      <div className="space-y-2">
        <Label>Heures d&apos;envoi</Label>
        <div className="flex items-center gap-3">
          <Select
            value={value.sending_window_start}
            onValueChange={(t) =>
              onChange({ ...value, sending_window_start: t })
            }
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">a</span>
          <Select
            value={value.sending_window_end}
            onValueChange={(t) =>
              onChange({ ...value, sending_window_end: t })
            }
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_SLOTS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sending days */}
      <div className="space-y-3">
        <Label>Jours d&apos;envoi</Label>
        <div className="flex flex-wrap gap-4">
          {DAYS.map((day) => (
            <label
              key={day.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={value.sending_days.includes(day.value)}
                onCheckedChange={(checked) =>
                  handleDayToggle(day.value, !!checked)
                }
              />
              <span className="text-sm">{day.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Daily limit */}
      <div className="space-y-2">
        <Label htmlFor="daily-limit">Limite journaliere</Label>
        <div className="flex items-center gap-3">
          <Input
            id="daily-limit"
            type="number"
            min={1}
            max={500}
            value={value.daily_limit}
            onChange={(e) =>
              onChange({
                ...value,
                daily_limit: Math.max(1, parseInt(e.target.value) || 1),
              })
            }
            className="w-[120px]"
          />
          <span className="text-sm text-muted-foreground">
            emails par jour
          </span>
        </div>
        {/* Slider */}
        <input
          type="range"
          min={1}
          max={500}
          value={value.daily_limit}
          onChange={(e) =>
            onChange({ ...value, daily_limit: parseInt(e.target.value) })
          }
          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1</span>
          <span>500</span>
        </div>
      </div>
    </div>
  );
}

export function getDefaultSchedule(): ScheduleData {
  return {
    timezone: DEFAULT_SENDING_WINDOW.timezone,
    sending_window_start: DEFAULT_SENDING_WINDOW.start,
    sending_window_end: DEFAULT_SENDING_WINDOW.end,
    sending_days: [...DEFAULT_SENDING_WINDOW.days],
    daily_limit: 50,
  };
}
