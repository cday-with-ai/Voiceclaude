import { execFileSync } from "node:child_process";
import { readFileSync, unlinkSync } from "node:fs";

export function transcribe(wavPath: string, modelPath: string): string {
  // whisper-cli outputs to <input>.txt when using --output-txt
  const env: Record<string, string> = { ...process.env as Record<string, string> };

  // Enable Metal GPU acceleration on Apple Silicon
  const whisperCellar = "/opt/homebrew/Cellar/whisper-cpp";
  env["GGML_METAL_PATH_RESOURCES"] = whisperCellar;

  execFileSync("whisper-cli", [
    "--model", modelPath,
    "--output-txt",
    "--no-timestamps",
    "--file", wavPath,
  ], {
    stdio: "pipe",
    env,
  });

  // whisper-cli creates <wavPath>.txt
  const txtPath = wavPath + ".txt";
  const text = readFileSync(txtPath, "utf-8").trim();

  // Clean up the generated txt file
  try {
    unlinkSync(txtPath);
  } catch {
    // ignore cleanup errors
  }

  return text;
}
