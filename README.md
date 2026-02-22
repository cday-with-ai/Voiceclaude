# VoiceClaude

Talk to Claude, Claude talks back. A voice interface for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that runs entirely in your terminal on macOS.

## How it works

VoiceClaude creates a speech loop: you speak into your mic, your speech is transcribed locally using [whisper.cpp](https://github.com/ggerganov/whisper.cpp), the text is sent to Claude, and the response is spoken aloud using macOS text-to-speech. Conversations persist across turns using Claude Code sessions.

### Modes

- **Push-to-talk** (default) — Press Enter to start recording, Enter again to stop. Your speech is transcribed and sent to Claude.
- **Always-listening** (`--always-listening`) — Experimental. Uses `whisper-stream` for continuous real-time transcription. An LLM classifier (Haiku) determines if you're talking to the assistant or if the audio is background noise, and only responds when addressed.

In both modes you can also type text directly and press Enter.

## Prerequisites

- **macOS** (uses `/usr/bin/say` for TTS)
- **[Homebrew](https://brew.sh)**
- **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** installed and authenticated

## Installation

### 1. Install system dependencies

```bash
brew install sox whisper-cpp
```

- `sox` provides the `rec` command for microphone recording (push-to-talk mode)
- `whisper-cpp` provides `whisper-cli` (push-to-talk) and `whisper-stream` (always-listening)

### 2. Download a Whisper model

```bash
mkdir -p ~/.voiceclaude/models
curl -L "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin" \
  -o ~/.voiceclaude/models/ggml-base.en.bin
```

### 3. Install VoiceClaude

```bash
git clone https://github.com/cday-with-ai/Voiceclaude.git
cd VoiceClaude
npm install
npm run build
npm link
```

## Usage

```bash
# Push-to-talk (default)
voiceclaude

# Always-listening mode (experimental)
voiceclaude --always-listening
```

### Push-to-talk controls

- **Enter** (empty) — start/stop recording
- **Type text + Enter** — send text directly
- **"quit" or Ctrl+C** — exit

### Always-listening

Just speak naturally. The system uses Haiku to classify whether you're talking to the assistant and responds accordingly. You can also type text and press Enter. Say "ok", "stop", or "thanks" to interrupt Claude while it's speaking.

## Configuration

All configuration is via environment variables:

| Variable | Default | Description |
|---|---|---|
| `VOICECLAUDE_VOICE` | `Samantha` | macOS TTS voice |
| `VOICECLAUDE_RATE` | `175` | Speech rate (words per minute) |
| `VOICECLAUDE_MODEL` | `~/.voiceclaude/models/ggml-base.en.bin` | Path to Whisper model |
| `VOICECLAUDE_CLAUDE_MODEL` | (default) | Claude model to use |
| `VOICECLAUDE_MODE` | `push-to-talk` | `push-to-talk` or `always-listening` |
| `VOICECLAUDE_CLASSIFIER_MODEL` | `claude-haiku-4-5-20251001` | Model for intent classification |
| `VOICECLAUDE_TMPDIR` | `/tmp/voiceclaude` | Temp directory for recordings |
| `VOICECLAUDE_CLAUDE_PATH` | `claude` | Path to Claude CLI binary |

## Project structure

```
src/
  cli/index.ts        # Entry point, mode selection, main loop
  audio/recorder.ts   # Mic recording via sox (push-to-talk)
  audio/listener.ts   # Continuous listening via whisper-stream
  stt/whisper.ts      # Batch transcription via whisper-cli
  tts/macos.ts        # Text-to-speech via macOS say
  claude/client.ts    # Claude Code CLI integration
  classifier/intent.ts # LLM-based intent classification
  config/loader.ts    # Configuration and preflight checks
```

## License

MIT
