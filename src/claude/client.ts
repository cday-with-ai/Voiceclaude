import { execFileSync } from "node:child_process";

export interface ClaudeResponse {
  response: string;
  sessionId: string;
}

const claudeBinary = process.env.VOICECLAUDE_CLAUDE_PATH ?? "claude";

export function askClaude(
  text: string,
  sessionId?: string,
  model?: string,
): ClaudeResponse {
  const args: string[] = [
    "-p", text,
    "--output-format", "json",
    "--append-system-prompt",
    "You are being spoken aloud via text-to-speech. Follow these rules strictly: Keep responses short — 2-3 sentences max unless the user asks for detail. Never include URLs, links, or raw paths — describe the source by name instead (e.g. say \"the Wikipedia article\" not the URL). No markdown, no bullets, no numbered lists, no code blocks, no special characters. Speak naturally in plain conversational English. If there is a lot of information, summarize the key points briefly and offer to go deeper.",
  ];

  if (sessionId) {
    args.push("--resume", sessionId);
  }

  if (model) {
    args.push("--model", model);
  }

  // Remove Claude Code env vars so claude can run as a subprocess
  const env: Record<string, string> = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (key === "CLAUDECODE" || key.startsWith("CLAUDE_CODE_")) continue;
    if (val !== undefined) {
      env[key] = val;
    }
  }

  const output = execFileSync(claudeBinary, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env,
    maxBuffer: 10 * 1024 * 1024,
  });

  const result = JSON.parse(output.toString("utf-8"));

  return {
    response: result.result ?? result.text ?? output.toString("utf-8").trim(),
    sessionId: result.session_id ?? sessionId ?? "",
  };
}
