// ─── Multi-Signal Scoring Engine ────────────────────────────────────────────
// Calculates a composite lead_score based on multiple weighted signals
// with temporal decay and combination bonuses.

interface Signal {
  signal_type: string;
  signal_score: number;
  is_active: boolean;
  expires_at: string | null;
  detected_at?: string;
  created_at?: string;
}

// Weight multipliers by signal type
const SIGNAL_WEIGHTS: Record<string, number> = {
  funding: 3.0,
  hiring: 2.5,
  expansion: 1.5,
  new_company: 2.5,
  pain_point_detected: 2.0,
  technology_change: 2.0,
  content_engagement: 1.0,
  competitor_engagement: 1.5,
  warm_intro: 3.0,
  event_attendance: 1.0,
  social_engagement: 0.5,
  website_visit: 0.5,
  job_change: 1.5,
};

// Combination bonuses: if both signal types present, multiply total by this
const COMBO_BONUSES: Array<{ types: [string, string]; multiplier: number }> = [
  { types: ["funding", "hiring"], multiplier: 1.5 },
  { types: ["expansion", "hiring"], multiplier: 1.3 },
  { types: ["pain_point_detected", "content_engagement"], multiplier: 1.4 },
  { types: ["new_company", "hiring"], multiplier: 1.3 },
];

/**
 * Calculate temporal decay factor.
 * Signals lose 50% of weight after 30 days, 75% after 60 days.
 */
function temporalDecay(signalDate: string | undefined | null): number {
  if (!signalDate) return 1;
  const age = Date.now() - new Date(signalDate).getTime();
  const days = age / (1000 * 60 * 60 * 24);

  if (days <= 7) return 1;
  if (days <= 30) return 0.8;
  if (days <= 60) return 0.5;
  if (days <= 90) return 0.25;
  return 0.1;
}

/**
 * Calculate composite score from prospect base score + weighted signals.
 */
export function calculateCompositeScore(
  baseScore: number,
  signals: Signal[]
): { score: number; signalBoost: number; breakdown: Record<string, number> } {
  const now = new Date();
  const activeSignals = signals.filter(
    (s) => s.is_active && (!s.expires_at || new Date(s.expires_at) > now)
  );

  if (activeSignals.length === 0) {
    return { score: Math.min(baseScore, 100), signalBoost: 0, breakdown: {} };
  }

  // Calculate weighted score per signal
  const breakdown: Record<string, number> = {};
  let totalWeightedScore = 0;

  for (const signal of activeSignals) {
    const weight = SIGNAL_WEIGHTS[signal.signal_type] ?? 1.0;
    const decay = temporalDecay(signal.detected_at || signal.created_at);
    const weighted = signal.signal_score * weight * decay;

    const key = signal.signal_type;
    breakdown[key] = (breakdown[key] || 0) + weighted;
    totalWeightedScore += weighted;
  }

  // Apply combination bonuses
  const signalTypes = new Set(activeSignals.map((s) => s.signal_type));
  let comboMultiplier = 1;

  for (const combo of COMBO_BONUSES) {
    if (signalTypes.has(combo.types[0]) && signalTypes.has(combo.types[1])) {
      comboMultiplier = Math.max(comboMultiplier, combo.multiplier);
    }
  }

  totalWeightedScore *= comboMultiplier;

  // Cap signal boost at 60 points
  const signalBoost = Math.min(Math.round(totalWeightedScore), 60);
  const finalScore = Math.min(baseScore + signalBoost, 100);

  return { score: finalScore, signalBoost, breakdown };
}
