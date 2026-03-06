"use client";

import { useState, useCallback } from "react";

interface AIGenerationParams {
  prospectId?: string;
  campaignId?: string;
  channel: "email" | "linkedin";
  stepNumber: number;
  linkedinMessageType?: "connection" | "followup" | "inmail";
  previousSubjects?: string[];
}

interface AIResearchParams {
  prospectId: string;
}

interface AIReplyAnalysisParams {
  prospectId: string;
  replyText: string;
  previousInteractions?: Array<{ role: string; content: string; sent_at?: string }>;
}

interface AIMeetingMessageParams {
  prospectId: string;
  channel?: "email" | "linkedin";
  bookingUrl?: string;
}

interface AIValueResponseParams {
  prospectId: string;
  replyText: string;
  replyAnalysis?: Record<string, unknown>;
}

interface AIStrategyParams {
  segmentStats: {
    totalProspects: number;
    avgProperties: number;
    topCities: string[];
    sources: Record<string, number>;
    statuses: Record<string, number>;
  };
  prospectIds: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResult = Record<string, any>;

export function useAIGeneration() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateOutreach = useCallback(
    async (params: AIGenerationParams): Promise<AnyResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agents/orchestrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur de generation");
        return data.result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const researchProspect = useCallback(
    async (params: AIResearchParams): Promise<AnyResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agents/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur de recherche");
        return data.research;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const analyzeReply = useCallback(
    async (params: AIReplyAnalysisParams): Promise<AnyResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agents/analyze-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur d'analyse");
        return data.analysis;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const generateMeetingMessage = useCallback(
    async (params: AIMeetingMessageParams): Promise<AnyResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agents/meeting-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur de generation");
        return data.result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const generateValueResponse = useCallback(
    async (params: AIValueResponseParams): Promise<AnyResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agents/value-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur de generation");
        return data.result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const getStrategy = useCallback(
    async (params: AIStrategyParams): Promise<AnyResult | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/agents/strategy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur de strategie");
        return data.strategy;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    generateOutreach,
    researchProspect,
    analyzeReply,
    generateMeetingMessage,
    generateValueResponse,
    getStrategy,
    isLoading,
    error,
  };
}
