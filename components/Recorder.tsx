"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "setup" | "starting" | "live" | "recording" | "paused" | "review" | "uploading" | "done" | "denied" | "unsupported" | "error";
interface Take {
  url: string;
  blob: Blob;
  seconds: number;
}

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];
const MAX_TAKES = 5;

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function clock(s: number): string {
  const v = Math.max(0, Math.floor(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}

export interface RecorderProps {
  prompts: string[];
  minSeconds: number;
  maxSeconds: number;
  uploadUrl: string;
  submitLabel: string;
  /** Called with the upload's JSON response once the server accepts it. */
  onUploaded: (data: Record<string, unknown>) => void;
  intro?: React.ReactNode;
}

export default function Recorder({ prompts, minSeconds, maxSeconds, uploadUrl, submitLabel, onUploaded, intro }: RecorderProps) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [elapsed, setElapsed] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);
  const [takes, setTakes] = useState<Take[]>([]);
  const [selected, setSelected] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const liveRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const bankedRef = useRef(0); // seconds recorded before the latest pause
  const elapsedRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const mimeRef = useRef("");
  const takesRef = useRef<Take[]>([]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("unsupported");
    }
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      stopTracks();
      takesRef.current.forEach((t) => URL.revokeObjectURL(t.url));
    };
  }, [stopTracks]);

  // Re-attach the live stream whenever the camera view is on screen.
  useEffect(() => {
    if ((phase === "live" || phase === "recording" || phase === "paused") && liveRef.current && streamRef.current) {
      if (liveRef.current.srcObject !== streamRef.current) liveRef.current.srcObject = streamRef.current;
    }
  }, [phase]);

  async function startCamera(mode: "user" | "environment") {
    setPhase("starting");
    setError(null);
    stopTracks();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      mimeRef.current = pickMime();
      setFacing(mode);
      setPhase("live");
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") setPhase("denied");
      else {
        setError("We couldn't start your camera. Close other apps that might be using it, then try again.");
        setPhase("error");
      }
    }
  }

  function tick() {
    const s = bankedRef.current + (performance.now() - startedAtRef.current) / 1000;
    elapsedRef.current = s;
    setElapsed(s);
    if (s >= maxSeconds) stop();
  }

  function record() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    bankedRef.current = 0;
    elapsedRef.current = 0;
    setElapsed(0);
    const rec = mimeRef.current
      ? new MediaRecorder(stream, { mimeType: mimeRef.current, videoBitsPerSecond: 2_500_000 })
      : new MediaRecorder(stream);
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      const type = rec.mimeType || mimeRef.current || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const take: Take = { url: URL.createObjectURL(blob), blob, seconds: Math.round(elapsedRef.current) };
      const next = [...takesRef.current, take].slice(-MAX_TAKES);
      takesRef.current = next;
      setTakes(next);
      setSelected(next.length - 1);
      setPhase("review");
    };
    recRef.current = rec;
    rec.start(1000);
    startedAtRef.current = performance.now();
    tickRef.current = window.setInterval(tick, 250);
    setPhase("recording");
  }

  function pause() {
    const rec = recRef.current;
    if (!rec || rec.state !== "recording") return;
    rec.pause();
    bankedRef.current += (performance.now() - startedAtRef.current) / 1000;
    if (tickRef.current) window.clearInterval(tickRef.current);
    setPhase("paused");
  }

  function resume() {
    const rec = recRef.current;
    if (!rec || rec.state !== "paused") return;
    rec.resume();
    startedAtRef.current = performance.now();
    tickRef.current = window.setInterval(tick, 250);
    setPhase("recording");
  }

  function stop() {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  function upload() {
    const take = takes[selected];
    if (!take) return;
    setPhase("uploading");
    setProgress(0);
    setError(null);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", uploadUrl);
    xhr.setRequestHeader("Content-Type", take.blob.type || "video/webm");
    xhr.setRequestHeader("X-Duration-Seconds", String(take.seconds));
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100);
        setPhase("done");
        stopTracks();
        onUploaded(data);
      } else {
        setError(typeof data.error === "string" ? data.error : "The upload didn't finish. Please try again.");
        setPhase("review");
      }
    };
    xhr.onerror = () => {
      setError("Your connection dropped. Please try again; your video is still here.");
      setPhase("review");
    };
    xhr.send(take.blob);
  }

  const showCamera = phase === "live" || phase === "recording" || phase === "paused";
  const current = takes[selected];
  const tooShort = current ? current.seconds < minSeconds : false;

  if (phase === "unsupported") {
    return (
      <div className="card">
        <h2>Your browser can't record video here</h2>
        <p style={{ margin: 0 }}>
          Please open your link in Safari (iPhone) or Chrome (Android or computer). Recording also needs a secure (https)
          connection.
        </p>
      </div>
    );
  }

  if (phase === "setup" || phase === "starting" || phase === "denied" || phase === "error") {
    return (
      <div className="card">
        {intro}
        <p style={{ margin: 0 }}>
          Find a quiet spot with light in front of you. Prompts will appear on screen while you record; skip any you like.
          Nothing is sent until you tap {submitLabel}.
        </p>
        {phase === "denied" ? (
          <p className="error" role="alert" style={{ margin: 0 }}>
            Camera access is turned off. Allow camera and microphone for this site in your browser settings, then try again.
          </p>
        ) : null}
        {error ? (
          <p className="error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        ) : null}
        <button type="button" className="btn btn-gold btn-block" onClick={() => startCamera(facing)} disabled={phase === "starting"}>
          {phase === "starting" ? "Starting camera…" : "Turn on my camera"}
        </button>
      </div>
    );
  }

  if (showCamera) {
    const pct = Math.min(100, (elapsed / maxSeconds) * 100);
    return (
      <div className="rec">
        <div className="rec-top">
          <span className="timer" role="timer" aria-label={`Recorded ${clock(elapsed)} of ${clock(maxSeconds)}`}>
            {phase === "recording" ? <span className="dot" aria-hidden="true" /> : null}
            {clock(elapsed)} / {clock(maxSeconds)}
          </span>
          <span className="small" style={{ color: "var(--on-navy)" }}>
            {phase === "paused" ? "Paused" : phase === "recording" ? "Recording" : `Aim for ${clock(minSeconds)}–${clock(maxSeconds)}`}
          </span>
        </div>
        <div className="bar" aria-hidden="true">
          <div style={{ width: `${pct}%` }} />
        </div>
        <div className="viewport">
          <video ref={liveRef} autoPlay playsInline muted className={facing === "user" ? "mirror" : undefined} aria-label="Camera preview" />
          {prompts.length > 0 ? (
            <div className="prompt-card">
              <span className="n">
                Question {promptIndex + 1} of {prompts.length}
              </span>
              <p aria-live="polite">{prompts[promptIndex]}</p>
              <div className="prompt-nav">
                <button type="button" onClick={() => setPromptIndex((i) => Math.max(0, i - 1))} disabled={promptIndex === 0}>
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPromptIndex((i) => Math.min(prompts.length - 1, i + 1))}
                  disabled={promptIndex === prompts.length - 1}
                  style={{ fontWeight: 600 }}
                >
                  Next question
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="rec-controls">
          <button
            type="button"
            className="round"
            aria-label="Switch camera"
            onClick={() => startCamera(facing === "user" ? "environment" : "user")}
            disabled={phase !== "live"}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
              <path d="M9 13a3 3 0 015-2M15 13a3 3 0 01-5 2" />
            </svg>
          </button>
          {phase === "live" ? (
            <button type="button" className="shutter" aria-label="Start recording" onClick={record}>
              <span />
            </button>
          ) : (
            <button type="button" className="shutter recording" aria-label="Stop recording" onClick={stop}>
              <span />
            </button>
          )}
          <button
            type="button"
            className="round"
            aria-label={phase === "paused" ? "Resume" : "Pause"}
            onClick={phase === "paused" ? resume : pause}
            disabled={phase === "live"}
          >
            {phase === "paused" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5l11 7-11 7z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            )}
          </button>
        </div>
      </div>
    );
  }

  // review, uploading, done
  return (
    <div className="stack">
      {current ? (
        <video key={current.url} src={current.url} controls playsInline className="video-frame" aria-label="Your recording" />
      ) : null}
      {takes.length > 1 ? (
        <div className="takes" role="group" aria-label="Choose a take">
          {takes.map((t, i) => (
            <button key={t.url} type="button" aria-pressed={i === selected} onClick={() => setSelected(i)} disabled={phase !== "review"}>
              Take {i + 1} · {clock(t.seconds)}
            </button>
          ))}
        </div>
      ) : null}
      {tooShort ? (
        <p className="notice" style={{ margin: 0 }}>
          This take is {clock(current!.seconds)}. Please aim for at least {clock(minSeconds)}.
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
      {phase === "uploading" || phase === "done" ? (
        <div className="card">
          <div className="row small">
            <strong id="up-label">{phase === "done" ? "Sent securely" : "Uploading securely"}</strong>
            <span className="spacer" />
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{progress}%</span>
          </div>
          <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-labelledby="up-label">
            <div style={{ width: `${progress}%` }} />
          </div>
          <span className="small muted">Keep this page open until it finishes.</span>
        </div>
      ) : (
        <>
          {takes.length < MAX_TAKES ? (
            <button type="button" className="btn btn-outline btn-block" onClick={() => setPhase("live")}>
              Record again ({MAX_TAKES - takes.length} left)
            </button>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              You've used all {MAX_TAKES} takes. Pick your favorite above.
            </p>
          )}
          <button type="button" className="btn btn-gold btn-block" onClick={upload} disabled={tooShort}>
            {submitLabel}
          </button>
        </>
      )}
    </div>
  );
}
