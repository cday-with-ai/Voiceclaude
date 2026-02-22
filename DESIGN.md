# VoiceClaude — Design Document

## What is VoiceClaude?

A voice interface for Claude. Talk to Claude, Claude talks back. No typing, no screen — just conversation. Works with all your skills (heartbeat, mailbot, newsbot, opskill) so you can say "check my email" or "what's in the news" and get a spoken answer.

Think of it as Universal Terminal, but for your ears.

## How It Works

### Loop

```
1. Listen for speech (microphone)
2. Transcribe to text (speech-to-text)
3. Send to Claude with full skill context
4. Receive response text
5. Speak the response (text-to-speech)
6. Go to 1
```

### Speech-to-Text Options

1. **macOS built-in** — `say` command does TTS, and macOS has dictation built in, but no clean CLI for STT
2. **Whisper (local)** — OpenAI's Whisper model runs locally, free, fast on Apple Silicon. `whisper.cpp` or `whisper-node`
3. **Deepgram / AssemblyAI** — cloud STT APIs, very accurate, low latency, paid
4. **Web Speech API** — if running in a browser (Electron or web app)

**Recommendation**: Whisper locally for privacy and no API costs. Falls back to cloud if needed.

### Text-to-Speech Options

1. **macOS `say` command** — free, built-in, decent quality. `say -v Samantha "hello"`
2. **ElevenLabs** — high-quality, natural-sounding voices, paid API
3. **Piper** — open source, runs locally, good quality
4. **Web Speech API** — if running in browser

**Recommendation**: Start with macOS `say` (zero setup). Upgrade to ElevenLabs or Piper for better voice quality later.

### Wake Word (Optional)

- Could listen continuously for a wake word ("Hey Claude", "Computer")
- Or just run as a push-to-talk CLI: press Enter to start talking, release to send
- Or always listening with silence detection to know when you've stopped talking

### Claude Integration

Same as Universal Terminal — Claude has access to all skills. The voice input is just another way to send a prompt. Claude's text response gets spoken back.

```
You: "When will my Amazon delivery arrive?"
  → Whisper transcribes → Claude → mailbot deliveries →
  → "Your standing desk arrives Thursday by 8pm"
  → macOS say speaks the response
```

## CLI Commands

```
voiceclaude                    # Start voice conversation (default mode)
voiceclaude --push-to-talk     # Press Enter to start/stop recording
voiceclaude --wake-word        # Listen for wake word
voiceclaude --voice samantha   # Choose TTS voice
voiceclaude --tts elevenlabs   # Use ElevenLabs for TTS
voiceclaude --stt whisper      # Use Whisper for STT (default)
```

## Modes

### Push-to-Talk (Default)
- Press Enter to start recording
- Speak your message
- Press Enter again (or silence detection) to stop
- Claude responds via TTS

### Always Listening
- Continuous microphone input
- Silence detection segments speech
- Each segment gets transcribed and sent to Claude
- Good for hands-free use

### Wake Word
- Listens passively for "Hey Claude" or configurable wake word
- Activates on wake word, listens for command
- Returns to passive after responding

## Architecture

```
src/
  cli/
    index.ts              # CLI entry point
  audio/
    recorder.ts           # Microphone capture (node-record-lpcm16 or similar)
    player.ts             # Audio playback for TTS output
    silence-detect.ts     # Detect end of speech
    wake-word.ts          # Wake word detection (optional)
  stt/
    whisper.ts            # Local Whisper transcription
    cloud.ts              # Cloud STT fallback
  tts/
    macos.ts              # macOS `say` command
    elevenlabs.ts         # ElevenLabs API
    piper.ts              # Local Piper TTS
  claude/
    client.ts             # Claude API with skill context
    context.ts            # Conversation history for multi-turn voice chat
  config/
    loader.ts             # Configuration
```

## Technical Stack

- **Language**: TypeScript (ESM, Node 20+)
- **STT**: whisper.cpp via whisper-node or child_process
- **TTS**: macOS `say` (built-in), optional ElevenLabs
- **Audio capture**: node-record-lpcm16 or sox
- **Claude**: @anthropic-ai/sdk
- **Binary**: `voiceclaude` → `dist/cli/index.js`

## Dependencies

- **sox** — audio recording: `brew install sox`
- **whisper.cpp** — local transcription: `brew install whisper-cpp` (or build from source)
- macOS `say` — already installed

## Skill Integration

VoiceClaude reads all installed skills from `~/.claude/skills/` just like Claude Code does. When you ask a question, Claude knows about heartbeat, mailbot, newsbot, opskill, and uses them as needed.

## Open Questions

- Should it maintain conversation history across sessions? (voice journal)
- Should it be able to interrupt Claude mid-response? ("stop, never mind")
- Could it run as a menu bar app instead of a CLI?
- Should responses be both spoken AND displayed as text?
- Integration with macOS Shortcuts for triggering from anywhere?
