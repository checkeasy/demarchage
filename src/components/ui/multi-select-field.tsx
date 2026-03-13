"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectFieldProps {
  label: string;
  options: readonly Option[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function MultiSelectField({
  label,
  options,
  value,
  onChange,
  disabled,
  readOnly,
}: MultiSelectFieldProps) {
  function toggle(optionValue: string) {
    if (disabled || readOnly) return;
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }

  // Read-only mode
  if (readOnly) {
    return (
      <div>
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {value.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {value.map((v) => {
              const opt = options.find((o) => o.value === v);
              return (
                <Badge key={v} variant="secondary" className="text-xs">
                  {opt?.label || v}
                </Badge>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">-</p>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => toggle(opt.value)}
              className={cn(
                "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors border",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                selected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
