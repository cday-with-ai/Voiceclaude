import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";

export type VoiceClaudeMode = "push-to-talk" | "always-listening";

export interface VoiceClaudeConfig {
  voice: string;
  speechRate: number;
  whisperModelPath: string;
  tempDir: string;
  claudeModel: string | undefined;
  mode: VoiceClaudeMode;
  classifierModel: string;
}

export function loadConfig(): VoiceClaudeConfig {
  const defaultModelPath = join(
    homedir(),
    ".voiceclaude",
    "models",
    "ggml-base.en.bin",
  );

  // Check for --always-listening CLI flag
  const hasAlFlag = process.argv.includes("--always-listening");

  let mode: VoiceClaudeMode = "push-to-talk";
  if (hasAlFlag || process.env.VOICECLAUDE_MODE === "always-listening") {
    mode = "always-listening";
  }

  return {
    voice: process.env.VOICECLAUDE_VOICE ?? "Samantha",
    speechRate: parseInt(process.env.VOICECLAUDE_RATE ?? "175", 10),
    whisperModelPath: process.env.VOICECLAUDE_MODEL ?? defaultModelPath,
    tempDir: process.env.VOICECLAUDE_TMPDIR ?? join(tmpdir(), "voiceclaude"),
    claudeModel: process.env.VOICECLAUDE_CLAUDE_MODEL ?? undefined,
    mode,
    classifierModel: process.env.VOICECLAUDE_CLASSIFIER_MODEL ?? "claude-haiku-4-5-20251001",
  };
}

function commandExists(cmd: string): boolean {
  try {
    execFileSync("which", [cmd], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function preflight(config: VoiceClaudeConfig): void {
  const missing: string[] = [];

  if (config.mode === "push-to-talk") {
    if (!commandExists("rec")) {
      missing.push("rec (install with: brew install sox)");
    }
    if (!commandExists("whisper-cli")) {
      missing.push("whisper-cli (install with: brew install whisper-cpp)");
    }
  }

  if (config.mode === "always-listening") {
    if (!commandExists("whisper-stream")) {
      missing.push("whisper-stream (install with: brew install whisper-cpp)");
    }
  }

  if (!commandExists("claude")) {
    missing.push("claude (install Claude Code CLI)");
  }
  if (!existsSync(config.whisperModelPath)) {
    missing.push(
      `whisper model at ${config.whisperModelPath}\n  Download: curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" -o ${config.whisperModelPath}`,
    );
  }

  if (missing.length > 0) {
    console.error("Missing dependencies:\n");
    for (const dep of missing) {
      console.error(`  - ${dep}`);
    }
    console.error("");
    process.exit(1);
  }
}
