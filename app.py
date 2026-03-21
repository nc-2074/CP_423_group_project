"""
app.py
------
Flask API that wraps the clinical interview IR pipeline.
Exposes HTTP endpoints that n8n and the frontend can call.

Endpoints:
    GET  /health       - check the API is running
    POST /upload       - upload an audio file from the frontend
    POST /pipeline     - run full offline pipeline on an audio file
    POST /index        - index a transcript into Supabase
    POST /retrieve     - retrieve segments for a query
    POST /analyze      - run all five MedGemma analysis modules
    GET  /             - serve the frontend
"""

import os
import json
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import subprocess
import requests

from speaker_separation.offline.pipeline import run_offline_pipeline
from ir.index import index_transcript, get_supabase_client, load_embedding_model
from ir.retrieve import retrieve
from ir.analyze import (
    summarize_interview,
    answer_symptom_question,
    analyze_interview_quality,
    recommend_referral,
    recommend_followup_questions,
    get_medgemma,
)
from sentence_transformers import SentenceTransformer

app = Flask(__name__)
CORS(app)

# ── Config ────────────────────────────────────────────────────────────
UPLOAD_FOLDER      = "audio"
ALLOWED_EXTENSIONS = {"wav", "mp3", "m4a"}
FRONTEND_FOLDER    = "frontend"

# ── Load shared resources once at startup ────────────────────────────
print("Loading shared resources...")
supabase        = get_supabase_client()
embedding_model = load_embedding_model()
print("Ready!")


def allowed_file(filename: str) -> bool:
    return "." in filename and \
           filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

# ── Webhook────────────────────────────

N8N_WEBHOOK_URL = "http://localhost:5678/webhook-test/clinical-pipeline"

def notify_n8n(transcript_path: str, audio_path: str, segment_count: int):
    """
    Notify n8n that the pipeline has finished and trigger
    the indexing and analysis workflow automatically.
    """
    try:
        requests.post(N8N_WEBHOOK_URL, json={
            "transcript_path": transcript_path,
            "audio_path":      audio_path,
            "segments":        segment_count,
        }, timeout=5)
        print(f"  n8n webhook triggered successfully.")
    except Exception as e:
        print(f"  Warning: Could not reach n8n webhook: {e}")

# ── Serve frontend ────────────────────────────────────────────────────

@app.route("/")
def home():
    """Serve the frontend index.html."""
    return send_from_directory("frontend/html", "index.html")

@app.route("/css/<path:filename>")
def css(filename):
    return send_from_directory("frontend/css", filename)

@app.route("/js/<path:filename>")
def js(filename):
    return send_from_directory("frontend/js", filename)


# ── Health check ──────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Simple health check so n8n can verify the API is running."""
    return jsonify({"status": "ok"})


# ── Upload ────────────────────────────────────────────────────────────

@app.route("/upload", methods=["POST"])
def upload():
    """
    Accept an audio file upload from the frontend.
    Saves it to the audio/ folder, converts to WAV if needed,
    and returns the path.

    Request: multipart/form-data with 'audio' field
    Response: { "audio_path": "audio/filename.wav" }
    """
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    file = request.files["audio"]

    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not allowed_file(file.filename):
        return jsonify({
            "error": "File type not supported. Use wav, mp3, or m4a"
        }), 400

    filename  = secure_filename(file.filename)
    save_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(save_path)

    # Convert to WAV if not already — Pyannote requires clean WAV
    if not filename.lower().endswith(".wav"):
        wav_path = os.path.splitext(save_path)[0] + ".wav"
        print(f"  Converting {filename} to WAV...")
        subprocess.run([
            "ffmpeg", "-y",
            "-i", save_path,
            "-ar", "16000",
            "-ac", "1",
            wav_path
        ], check=True, capture_output=True)
        os.remove(save_path)  # remove original mp3
        save_path = wav_path
        print(f"  Converted to: {wav_path}")

    print(f"  Uploaded: {save_path}")
    return jsonify({"audio_path": save_path})


# ── Pipeline ──────────────────────────────────────────────────────────

@app.route("/pipeline", methods=["POST"])
def pipeline():
    data        = request.json
    audio_path  = data.get("audio_path")
    patient_spk = data.get("patient_speaker", None)

    if not audio_path:
        return jsonify({"error": "audio_path is required"}), 400

    if not Path(audio_path).exists():
        return jsonify({"error": f"Audio file not found: {audio_path}"}), 404

    output_path = Path(audio_path).stem + "_transcript.json"

    transcript = run_offline_pipeline(
        audio_path=audio_path,
        patient_speaker=patient_spk,
        output_path=output_path,
    )

    # Notify n8n to trigger indexing and analysis automatically
    notify_n8n(output_path, audio_path, len(transcript))

    return jsonify({
        "transcript":  transcript,
        "output_path": output_path,
        "segments":    len(transcript),
    })


# ── Index ─────────────────────────────────────────────────────────────

@app.route("/index", methods=["POST"])
def index_endpoint():
    """
    Index a transcript into Supabase.

    Request body:
        { "transcript_path": "interview_transcript.json" }

    Response:
        { "indexed": 9, "message": "Indexing complete." }
    """
    data            = request.json
    transcript_path = data.get("transcript_path")

    if not transcript_path:
        return jsonify({"error": "transcript_path is required"}), 400

    if not Path(transcript_path).exists():
        return jsonify({"error": f"Transcript not found: {transcript_path}"}), 404

    segments = json.loads(Path(transcript_path).read_text())

    index_transcript(
        segments,
        supabase=supabase,
        embedding_model=embedding_model,
    )

    return jsonify({
        "indexed": len(segments),
        "message": "Indexing complete."
    })


# ── Retrieve ──────────────────────────────────────────────────────────

@app.route("/retrieve", methods=["POST"])
def retrieve_endpoint():
    """
    Retrieve relevant segments for a query.

    Request body:
        {
            "query": "what symptoms does the patient have?",
            "mode":  "patient",
            "k":     5
        }

    Response:
        {
            "results": [...],
            "query":   "what symptoms does the patient have?",
            "mode":    "patient",
            "k":       5
        }
    """
    data  = request.json
    query = data.get("query")
    mode  = data.get("mode", "all")
    k     = data.get("k", 5)

    if not query:
        return jsonify({"error": "query is required"}), 400

    results = retrieve(
        query,
        k=k,
        mode=mode,
        embedding_model=embedding_model,
    )

    return jsonify({
        "results": results,
        "query":   query,
        "mode":    mode,
        "k":       k,
    })


# ── Analyze ───────────────────────────────────────────────────────────

@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Run all five MedGemma analysis modules on a transcript.

    Request body:
        { "transcript_path": "interview_transcript.json" }

    Response:
        {
            "summary":    "...",
            "symptom_qa": "...",
            "quality":    "...",
            "referral":   "...",
            "followup":   "..."
        }
    """
    data            = request.json
    transcript_path = data.get("transcript_path")

    if not transcript_path:
        return jsonify({"error": "transcript_path is required"}), 400

    if not Path(transcript_path).exists():
        return jsonify({"error": f"Transcript not found: {transcript_path}"}), 404

    segments = json.loads(Path(transcript_path).read_text())

    # Load MedGemma once — cached globally after first call
    get_medgemma()
    emb_model = SentenceTransformer("all-MiniLM-L6-v2")

    summary  = summarize_interview(segments)
    qa       = answer_symptom_question(
                   "What symptoms does the patient have and how long have they had them?",
                   all_segments=segments,
                   embedding_model=emb_model,
               )
    quality  = analyze_interview_quality(segments)
    referral = recommend_referral(segments)
    followup = recommend_followup_questions(segments)

    return jsonify({
        "summary":    summary,
        "symptom_qa": qa,
        "quality":    quality,
        "referral":   referral,
        "followup":   followup,
    })


# ── Run ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=False,
    )
