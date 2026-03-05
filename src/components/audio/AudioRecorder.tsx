"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Pause, Square, Play, RotateCcw, Check, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  onCancel: () => void;
  maxDurationSeconds?: number;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function AudioRecorder({
  onRecordingComplete,
  onCancel,
  maxDurationSeconds = 1800,
}: AudioRecorderProps) {
  const {
    state,
    duration,
    audioBlob,
    audioUrl,
    analyserNode,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder();

  const [captureSystem, setCaptureSystem] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Auto-stop at max duration
  useEffect(() => {
    if (state === "recording" && duration >= maxDurationSeconds) {
      stopRecording();
    }
  }, [state, duration, maxDurationSeconds, stopRecording]);

  // Waveform visualization
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyserNode.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "rgb(248, 250, 252)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgb(239, 68, 68)";
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  }, [analyserNode]);

  useEffect(() => {
    if (state === "recording" && analyserNode) {
      drawWaveform();
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [state, analyserNode, drawWaveform]);

  const handleStart = async () => {
    try {
      await startRecording(captureSystem);
    } catch {
      // Permission denied or error - stays in idle state
    }
  };

  // IDLE state
  if (state === "idle") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="size-4 text-muted-foreground" />
            <Label htmlFor="capture-system" className="text-sm cursor-pointer">
              Micro + son PC (VoIP)
            </Label>
          </div>
          <Switch
            id="capture-system"
            checked={captureSystem}
            onCheckedChange={setCaptureSystem}
          />
        </div>
        {captureSystem && (
          <p className="text-xs text-muted-foreground">
            Chrome uniquement. Une popup demandera de partager l&apos;audio du systeme.
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <Button
            type="button"
            size="lg"
            variant="destructive"
            className="rounded-full size-16"
            onClick={handleStart}
          >
            <Mic className="size-6" />
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Cliquez pour demarrer l&apos;enregistrement (max {Math.floor(maxDurationSeconds / 60)} min)
        </p>
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </div>
    );
  }

  // RECORDING state
  if (state === "recording" || state === "paused") {
    return (
      <div className="space-y-4">
        {/* Recording indicator + timer */}
        <div className="flex items-center justify-center gap-3">
          {state === "recording" && (
            <span className="relative flex size-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full size-3 bg-red-500" />
            </span>
          )}
          {state === "paused" && (
            <span className="inline-flex rounded-full size-3 bg-amber-500" />
          )}
          <span className="text-2xl font-mono font-semibold tabular-nums">
            {formatTime(duration)}
          </span>
        </div>

        {/* Waveform */}
        <canvas
          ref={canvasRef}
          width={400}
          height={60}
          className="w-full h-[60px] rounded bg-slate-50 border border-slate-100"
        />

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {state === "recording" ? (
            <Button type="button" variant="outline" size="icon" onClick={pauseRecording}>
              <Pause className="size-4" />
            </Button>
          ) : (
            <Button type="button" variant="outline" size="icon" onClick={resumeRecording}>
              <Play className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="size-12 rounded-full"
            onClick={stopRecording}
          >
            <Square className="size-5" />
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          {state === "paused" ? "En pause" : "Enregistrement en cours..."}
        </p>
      </div>
    );
  }

  // STOPPED state - preview
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <span className="text-lg font-mono font-semibold tabular-nums">
          {formatTime(duration)}
        </span>
      </div>

      {audioUrl && (
        <audio controls src={audioUrl} className="w-full" />
      )}

      <div className="flex items-center justify-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={resetRecording}>
          <RotateCcw className="size-3.5 mr-1.5" />
          Recommencer
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            if (audioBlob) onRecordingComplete(audioBlob, duration);
          }}
        >
          <Check className="size-3.5 mr-1.5" />
          Utiliser
        </Button>
      </div>
    </div>
  );
}
