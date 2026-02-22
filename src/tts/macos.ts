import { spawn } from "node:child_process";

export interface SpeakOptions {
  voice?: string;
  rate?: number;
}

export interface SpeakHandle {
  promise: Promise<void>;
  cancel: () => void;
}

export function speak(text: string, options: SpeakOptions = {}): SpeakHandle {
  const args: string[] = [];

  if (options.voice) {
    args.push("-v", options.voice);
  }
  if (options.rate) {
    args.push("-r", String(options.rate));
  }
  args.push(text);

  const proc = spawn("/usr/bin/say", args, { stdio: "ignore" });
  let cancelled = false;

  const promise = new Promise<void>((resolve, reject) => {
    proc.on("close", (code) => {
      if (cancelled || code === 0) {
        resolve();
      } else {
        reject(new Error(`say exited with code ${code}`));
      }
    });

    proc.on("error", reject);
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      proc.kill("SIGTERM");
    },
  };
}
