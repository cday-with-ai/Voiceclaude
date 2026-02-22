import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

export interface ListenerHandle {
  stop: () => void;
  /** Set a callback for interrupt phrases detected while speaking. Pass null to clear. */
  onInterrupt: (cb: (() => void) | null) => void;
}

const INTERRUPT_PHRASES = [
  "ok",
  "okay",
  "stop",
  "shut up",
  "enough",
  "thanks",
  "thank you",
  "got it",
];

function isInterruptPhrase(text: string): boolean {
  const lower = text.toLowerCase().replace(/[,.:;!?\s]+/g, " ").trim();
  return INTERRUPT_PHRASES.some((phrase) => lower.includes(phrase));
}

// Filter out whisper noise — repeated characters, pure punctuation, etc.
function isNoise(text: string): boolean {
  const stripped = text.replace(/[^a-zA-Z0-9]/g, "");
  if (stripped.length < 2) return true;
  // Repeated single character like "aaaa" or "tttt"
  if (/^(.)\1+$/.test(stripped)) return true;
  return false;
}

export function startListening(
  modelPath: string,
  onUtterance: (text: string) => void,
): ListenerHandle {
  const proc: ChildProcess = spawn(
    "whisper-stream",
    [
      "--model", modelPath,
      "--step", "2000",
      "--vad-thold", "0.6",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );

  let utteranceBuffer = "";
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let interruptCb: (() => void) | null = null;

  const MAX_BUFFER_MS = 15000; // force flush after 15s of continuous speech

  function flush(): void {
    const text = utteranceBuffer.trim();
    utteranceBuffer = "";
    if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
    if (text) {
      onUtterance(text);
    }
  }

  const rl = createInterface({ input: proc.stdout! });

  rl.on("line", (raw) => {
    const line = raw.trim();
    if (!line) return;

    // Detect silence — whisper-stream outputs [BLANK_AUDIO] when VAD detects no speech
    const isSilent = /\[BLANK_AUDIO\]/i.test(line);

    if (isSilent) {
      // Silence detected — if we have buffered speech, flush it now
      if (utteranceBuffer.trim()) {
        flush();
      }
      return;
    }

    // Strip artifacts but keep the text
    const cleaned = line
      .replace(/\(inaudible\)/gi, "")
      .replace(/\[.*?\]/g, "")
      .trim();

    if (!cleaned || isNoise(cleaned)) return;

    // Interrupt detection — only active during TTS playback
    if (interruptCb && isInterruptPhrase(cleaned)) {
      interruptCb();
      interruptCb = null;
      utteranceBuffer = "";
      if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
      return;
    }

    // Accumulate speech
    utteranceBuffer += " " + cleaned;

    // Start max buffer timer on first text
    if (!maxTimer) {
      maxTimer = setTimeout(flush, MAX_BUFFER_MS);
    }
  });

  // Log stderr for debugging
  if (proc.stderr) {
    const errRl = createInterface({ input: proc.stderr });
    errRl.on("line", (line) => {
      if (line.includes("error") || line.includes("failed")) {
        console.error(`[whisper-stream] ${line}`);
      }
    });
  }

  proc.on("error", (err) => {
    console.error(`whisper-stream failed to start: ${err.message}`);
  });

  return {
    stop: () => {
      if (maxTimer) clearTimeout(maxTimer);
      proc.kill("SIGTERM");
    },
    onInterrupt: (cb) => {
      interruptCb = cb;
    },
  };
}
