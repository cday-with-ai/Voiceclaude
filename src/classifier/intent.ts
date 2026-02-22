import { execFileSync } from "node:child_process";

const claudeBinary = process.env.VOICECLAUDE_CLAUDE_PATH ?? "claude";

const CLASSIFIER_PROMPT = `You are a speech intent classifier. You will receive transcribed audio. Determine if the speaker is talking to an AI assistant (asking a question, giving a command, making a request, continuing a conversation) versus any of these:
- Background noise transcribed as random words
- Keyboard typing or clicking sounds transcribed as gibberish
- The speaker talking to someone else (not an AI)
- The speaker talking to themselves / thinking aloud
- Music, TV, or other media playing
- Very short meaningless fragments like "um", "uh", "hmm", single letters, or repeated characters

Reply with ONLY the word "yes" or "no". Nothing else.`;

export function isDirectedAtAssistant(
  text: string,
  model?: string,
): boolean {
  const args: string[] = [
    "-p", `Transcribed speech: "${text}"`,
    "--output-format", "text",
    "--system-prompt", CLASSIFIER_PROMPT,
    "--model", model ?? "claude-haiku-4-5-20251001",
    "--max-turns", "1",
  ];

  const env: Record<string, string> = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_")) continue;
    if (val !== undefined) {
      env[key] = val;
    }
  }

  try {
    const output = execFileSync(claudeBinary, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env,
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    });

    const answer = output.toString("utf-8").trim().toLowerCase();
    return answer.startsWith("yes");
  } catch {
    // On error/timeout, default to no to avoid false positives
    return false;
  }
}
