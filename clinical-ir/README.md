# Clinical IR System — Speaker Separation

## Project Structure
```
clinical-ir/
├── speaker_separation/
│   ├── offline/          ← YOU ARE HERE (Phase 1)
│   │   ├── diarize.py    ← Step 1: who spoke when (Pyannote)
│   │   ├── transcribe.py ← Step 2: what was said (Whisper/Groq)
│   │   ├── align.py      ← Step 3: merge into labeled transcript
│   │   └── pipeline.py   ← runs all 3 steps together
│   └── online/           ← Phase 2 (LiveKit - coming next)
├── indexing/             ← Phase 3
├── retrieval/            ← Phase 4
├── evaluation/           ← Phase 5
├── .env.example
└── requirements.txt
```

## Setup (do this ONCE)

### 1. Clone and install
```bash
git clone <your-repo>
cd clinical-ir
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Install ffmpeg (required for audio processing)
- **Mac**: `brew install ffmpeg`
- **Ubuntu/Debian**: `sudo apt install ffmpeg`
- **Windows**: Download from https://ffmpeg.org/download.html

### 3. Get your free API keys
Copy `.env.example` to `.env` and fill in:

**Hugging Face token** (for Pyannote):
1. Create account at https://huggingface.co
2. Go to https://huggingface.co/settings/tokens → New token (read)
3. Accept model terms at https://huggingface.co/pyannote/speaker-diarization-3.1
4. Accept model terms at https://huggingface.co/pyannote/segmentation-3.0

**Groq API key** (for Whisper):
1. Create account at https://console.groq.com
2. Go to API Keys → Create new key

### 4. Run offline pipeline
```bash
python -m speaker_separation.offline.pipeline interview.wav --output result.json
```

## Output Format
```json
[
  {"speaker": "SPEAKER_0", "role": "PATIENT",   "start": 0.0,  "end": 4.2,  "text": "..."},
  {"speaker": "SPEAKER_1", "role": "CLINICIAN", "start": 4.5,  "end": 9.1,  "text": "..."}
]
```
