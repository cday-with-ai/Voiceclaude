import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

export interface RecordingHandle {
  wavPath: string;
  stop: () => Promise<string>;
}

export function startRecording(tempDir: string): RecordingHandle {
  mkdirSync(tempDir, { recursive: true });

  const wavPath = join(tempDir, `recording-${Date.now()}.wav`);

  // rec: 1 channel, 16kHz, 16-bit signed, WAV format
  const proc: ChildProcess = spawn(
    "rec",
    ["-c", "1", "-r", "16000", "-b", "16", "-t", "wav", wavPath],
    { stdio: ["pipe", "ignore", "ignore"] },
  );

  return {
    wavPath,
    stop: () =>
      new Promise((resolve, reject) => {
        proc.on("close", () => resolve(wavPath));
        proc.on("error", reject);

        // SIGINT tells rec to finalize the WAV header and exit cleanly
        proc.kill("SIGINT");
      }),
  };
}
