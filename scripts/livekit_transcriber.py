"""
LiveKit Real-time Transcriber with Groq Whisper - Optimized
With preloading and timing diagnostics
"""

import os
import asyncio
import logging
import time
from dotenv import load_dotenv
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    AgentSession,
    Agent
)
from livekit.plugins import groq
from livekit.plugins.silero import VAD

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("transcriber")

# ========== PRELOAD ONCE (GLOBAL) ==========
# This avoids downloading/loading models on every connection
print("🔄 Preloading models (this happens once at startup)...")
start_preload = time.time()

# Preload VAD model
vad = VAD.load()
print(f"✅ VAD loaded in {time.time() - start_preload:.2f}s")

# Preload Groq STT
stt = groq.STT()
print(f"✅ Groq STT initialized in {time.time() - start_preload:.2f}s")
print("=" * 60)


class TranscriptionAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions="You are a real-time transcriber. Just transcribe what you hear.",
            stt=stt,  # Use preloaded STT
        )

    async def on_user_turn_completed(self, chat_ctx, new_message):
        """Called when user speech is transcribed"""
        if new_message and hasattr(new_message, 'text_content') and new_message.text_content:
            timestamp = time.strftime("%H:%M:%S")
            print(f"[{timestamp}] {new_message.text_content}")

            # Save to file
            with open("transcript_log.txt", "a", encoding="utf-8") as f:
                f.write(f"[{timestamp}] {new_message.text_content}\n")


async def entrypoint(ctx: JobContext):
    """Main entry point for the agent"""
    print("\n" + "=" * 60)
    print("LIVEKIT REAL-TIME TRANSCRIBER (Optimized)")
    print("=" * 60)

    # Verify credentials
    required_vars = ["LIVEKIT_URL", "LIVEKIT_API_KEY",
                     "LIVEKIT_API_SECRET", "GROQ_API_KEY"]
    missing = [v for v in required_vars if not os.getenv(v)]
    if missing:
        print(f"❌ Missing env vars: {', '.join(missing)}")
        return

    print(f"✅ Connecting to room: {ctx.room.name}")

    try:
        # Connect to the room (audio only)
        start_connect = time.time()
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        print(
            f"✅ Connected to LiveKit room ({time.time() - start_connect:.2f}s)")

        # Create agent session with preloaded components
        start_session = time.time()
        session = AgentSession(
            stt=stt,   # Preloaded
            vad=vad,   # Preloaded
        )

        agent = TranscriptionAgent()

        await session.start(
            agent=agent,
            room=ctx.room,
        )
        print(f"✅ Session started ({time.time() - start_session:.2f}s)")

        print("\n🎤 Transcriber ready! Waiting for participants...")
        print("   Speaker labels will appear automatically")
        print("   Press Ctrl+C to stop\n")

        # Keep running
        while True:
            await asyncio.sleep(1)

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        print("\n👋 Transcriber stopped")


if __name__ == "__main__":
    # Run the worker
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
