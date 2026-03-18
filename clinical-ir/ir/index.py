"""
index.py
--------
Step 4 of offline pipeline: take the aligned, speaker-labeled transcript
segments and store them in Supabase with embeddings for semantic search.

Each segment gets:
- Its metadata (speaker, role, start, end, text) stored as a row
- A vector embedding generated from the text for semantic search

This enables queries like:
- "What symptoms did the patient describe?"
- "When did the clinician ask about medications?"

Upsert is used instead of insert so that:
- Running index.py twice on the same transcript does not create duplicates
- If a transcript is corrected and re-indexed, embeddings are updated automatically
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from sentence_transformers import SentenceTransformer

load_dotenv()

# Model for generating embeddings
# all-MiniLM-L6-v2 is small, fast, and free — outputs 384-dimensional vectors
# which matches the VECTOR(384) column in Supabase
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def get_supabase_client() -> Client:
    """Create a Supabase client using keys from .env"""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL or SUPABASE_KEY is missing from your .env file."
        )

    return create_client(url, key)


def load_embedding_model() -> SentenceTransformer:
    """
    Load the sentence transformer model for generating embeddings.
    Downloads on first run (~90MB) and caches for future runs.
    """
    print(f"Loading embedding model ({EMBEDDING_MODEL})...")
    model = SentenceTransformer(EMBEDDING_MODEL)
    print("Embedding model loaded.")
    return model


def generate_embedding(text: str, model: SentenceTransformer) -> list[float]:
    """
    Generate a vector embedding for a piece of text.

    Parameters
    ----------
    text : str
        The transcript segment text to embed.
    model : SentenceTransformer
        Pre-loaded embedding model.

    Returns
    -------
    list[float]
        384-dimensional vector embedding.
    """
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.tolist()


def index_transcript(
    segments: list[dict],
    supabase: Client = None,
    embedding_model: SentenceTransformer = None,
) -> None:
    """
    Store all transcript segments in Supabase with embeddings.
    Uses upsert instead of insert to prevent duplicates and ensure
    embeddings are always up to date if a transcript is re-indexed.

    Parameters
    ----------
    segments : list[dict]
        Speaker-labeled transcript from align.py:
        [{"speaker", "role", "start", "end", "text"}, ...]
    supabase : Client, optional
        Pre-initialized Supabase client.
    embedding_model : SentenceTransformer, optional
        Pre-loaded embedding model.
    """
    if supabase is None:
        supabase = get_supabase_client()

    if embedding_model is None:
        embedding_model = load_embedding_model()

    print(f"Indexing {len(segments)} segments into Supabase...")

    for i, seg in enumerate(segments):
        # Generate embedding for this segment's text
        embedding = generate_embedding(seg["text"], embedding_model)

        # Upsert into Supabase — inserts if new, updates if already exists
        supabase.table("transcript_segments").upsert({
            "speaker":    seg["speaker"],
            "role":       seg["role"],
            "start_time": seg["start"],
            "end_time":   seg["end"],
            "text":       seg["text"],
            "embedding":  embedding,
        }).execute()

        print(f"  Indexed segment {i + 1}/{len(segments)}: "
              f"[{seg['role']}] {seg['text'][:50]}...")

    print(f"Indexing complete. {len(segments)} segments stored in Supabase.")


# ── Quick test ───────────────────────────────────────────────────────
if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) < 2:
        print("Usage: python index.py path/to/transcript.json")
        sys.exit(1)

    transcript_path = Path(sys.argv[1])
    if not transcript_path.exists():
        raise FileNotFoundError(f"Transcript file not found: {transcript_path}")

    segments = json.loads(transcript_path.read_text())
    index_transcript(segments)