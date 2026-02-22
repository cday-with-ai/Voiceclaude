#!/usr/bin/env node

import * as readline from "node:readline";
import { unlinkSync } from "node:fs";
import { loadConfig, preflight } from "../config/loader.js";
import { speak, type SpeakHandle } from "../tts/macos.js";
import { startRecording } from "../audio/recorder.js";
import { transcribe } from "../stt/whisper.js";
import { askClaude } from "../claude/client.js";
import { startListening, type ListenerHandle } from "../audio/listener.js";
import { isDirectedAtAssistant } from "../classifier/intent.js";

const config = loadConfig();
preflight(config);

let sessionId: string | undefined;

if (config.mode === "always-listening") {
  runAlwaysListening();
} else {
  runPushToTalk();
}

// ---------------------------------------------------------------------------
// Always-listening mode
// ---------------------------------------------------------------------------

function runAlwaysListening(): void {
  console.log("");
  console.log("  VoiceClaude v1 — Always Listening");
  console.log("  Just speak naturally — I'll respond when you're talking to me.");
  console.log("  Or type a message and press Enter to send text directly.");
  console.log('  Type "quit" or Ctrl+C to exit.');
  console.log("");

  let processing = false;
  let listener: ListenerHandle | null = null;

  function startListener(): void {
    console.log("\x1b[32m[Listening]\x1b[0m");
    listener = startListening(
      config.whisperModelPath,
      async (utterance) => {
        if (processing) return;

        // Ask Haiku: is this directed at the assistant?
        console.log(`\x1b[2m[Heard: ${utterance}]\x1b[0m`);
        const directed = isDirectedAtAssistant(utterance, config.classifierModel);

        if (!directed) {
          console.log("\x1b[2m[Ignored — not directed at me]\x1b[0m");
          return;
        }

        processing = true;
        try {
          await sendToClaude(utterance, listener);
        } catch (err) {
          console.error("Error:", (err as Error).message);
        }
        processing = false;
        console.log("\x1b[32m[Listening]\x1b[0m");
      },
    );
  }

  startListener();

  // Also accept typed input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on("line", async (input) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase() === "quit") {
      console.log("Goodbye!");
      listener?.stop();
      rl.close();
      process.exit(0);
    }

    if (processing) {
      console.log("(Still processing previous command, please wait)");
      return;
    }

    processing = true;
    try {
      await sendToClaude(trimmed, listener);
    } catch (err) {
      console.error("Error:", (err as Error).message);
    }
    processing = false;
    console.log("\x1b[32m[Listening]\x1b[0m");
  });

  process.on("SIGINT", () => {
    console.log("\nGoodbye!");
    listener?.stop();
    rl.close();
    process.exit(0);
  });
}

// ---------------------------------------------------------------------------
// Push-to-talk mode (original behavior)
// ---------------------------------------------------------------------------

function runPushToTalk(): void {
  console.log("");
  console.log("  VoiceClaude v1 — Push to Talk");
  console.log("  Press Enter to start recording, Enter again to stop.");
  console.log("  Or type a message and press Enter to send text directly.");
  console.log('  Type "quit" or Ctrl+C to exit.');
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let recording: ReturnType<typeof startRecording> | null = null;

  function prompt(): void {
    const label = recording ? "\x1b[31m[Recording]\x1b[0m Enter to stop > " : "> ";
    rl.question(label, async (input) => {
      try {
        await handleInput(input);
      } catch (err) {
        console.error("Error:", (err as Error).message);
      }
      prompt();
    });
  }

  async function handleInput(input: string): Promise<void> {
    if (recording) {
      console.log("Transcribing...");
      const wavPath = await recording.stop();
      recording = null;

      let text: string;
      try {
        text = transcribe(wavPath, config.whisperModelPath);
      } finally {
        cleanupFile(wavPath);
      }

      if (!text) {
        console.log("(No speech detected)");
        return;
      }

      console.log(`You said: ${text}`);
      await sendToClaude(text);
      return;
    }

    const trimmed = input.trim();

    if (trimmed.toLowerCase() === "quit") {
      console.log("Goodbye!");
      rl.close();
      process.exit(0);
    }

    if (trimmed === "") {
      console.log("Recording... (press Enter to stop)");
      recording = startRecording(config.tempDir);
      return;
    }

    await sendToClaude(trimmed);
  }

  process.on("SIGINT", () => {
    console.log("\nGoodbye!");
    if (recording) {
      recording.stop().catch(() => {});
    }
    rl.close();
    process.exit(0);
  });

  prompt();
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

async function sendToClaude(text: string, listener?: ListenerHandle | null): Promise<void> {
  console.log("Thinking...");

  const result = askClaude(text, sessionId, config.claudeModel);
  sessionId = result.sessionId;

  console.log(`\nClaude: ${result.response}\n`);

  console.log("Speaking...");
  const handle = speak(result.response, {
    voice: config.voice,
    rate: config.speechRate,
  });

  // Let the user interrupt speech by saying "ok", "stop", etc.
  if (listener) {
    listener.onInterrupt(() => {
      handle.cancel();
      console.log("\x1b[33m[Interrupted]\x1b[0m");
    });
  }

  await handle.promise;

  if (listener) {
    listener.onInterrupt(null);
  }
}

function cleanupFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // ignore
  }
}
