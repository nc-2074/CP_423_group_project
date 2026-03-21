const API_URL = 'http://localhost:5001';
let isProcessing = false;

// ── Mode switching ────────────────────────────────────────────────────
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const mode = btn.dataset.mode;
        document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`${mode}-mode`).classList.add('active');
    });
});

// ── File upload handling ──────────────────────────────────────────────
const dropArea  = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const fileInfo  = document.getElementById('file-info');
const fileName  = document.getElementById('file-name');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight() {
    dropArea.classList.add('highlight');
}

function unhighlight() {
    dropArea.classList.remove('highlight');
}

dropArea.addEventListener('drop', handleDrop, false);
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFiles);

function handleDrop(e) {
    const dt    = e.dataTransfer;
    const files = dt.files;
    handleFiles({ target: { files } });
}

function handleFiles(e) {
    const files = e.target.files;
    if (files.length) {
        const file = files[0];
        fileName.textContent = file.name;
        fileInfo.classList.remove('hidden');
        // User clicks Process Interview button — no auto-process
    }
}

// ── Process interview ─────────────────────────────────────────────────
document.getElementById('process-btn')?.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (file) processInterview(file);
});

async function processInterview(file) {
    if (isProcessing) return;
    isProcessing = true;

    showResults();
    document.getElementById('transcript-content').innerHTML =
        '<p>⏳ Uploading audio file...</p>';

    try {
        // Step 1 — upload the file to Flask
        const formData = new FormData();
        formData.append('audio', file);

        const uploadRes = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!uploadRes.ok) throw new Error('Upload failed');
        const uploadData = await uploadRes.json();
        const audioPath  = uploadData.audio_path;

        document.getElementById('transcript-content').innerHTML =
            '<p>⏳ Running speaker separation and transcription...</p>';

        // Step 2 — run the pipeline
        const pipelineRes = await fetch(`${API_URL}/pipeline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio_path: audioPath }),
        });

        if (!pipelineRes.ok) throw new Error('Pipeline failed');
        const pipelineData = await pipelineRes.json();

        document.getElementById('transcript-content').innerHTML =
            '<p>⏳ Indexing transcript...</p>';

        // Step 3 — index the transcript
        const indexRes = await fetch(`${API_URL}/index`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript_path: pipelineData.output_path }),
        });

        if (!indexRes.ok) throw new Error('Indexing failed');

        document.getElementById('transcript-content').innerHTML =
            '<p>⏳ Running MedGemma analysis (this takes a minute)...</p>';

        // Step 4 — run analysis
        const analysisRes = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript_path: pipelineData.output_path }),
        });

        if (!analysisRes.ok) throw new Error('Analysis failed');
        const analysisData = await analysisRes.json();

        // Display results
        displayTranscript(pipelineData.transcript);
        displayAnalysis(analysisData);

    } catch (err) {
        document.getElementById('transcript-content').innerHTML =
            `<p>❌ Error: ${err.message}</p>`;
        console.error(err);
    } finally {
        isProcessing = false;
    }
}

// ── Generate tokens for LiveKit ───────────────────────────────────────
document.getElementById('generate-tokens-btn')?.addEventListener('click', generateTokens);

async function generateTokens() {
    const tokensDiv = document.getElementById('tokens-display');
    tokensDiv.classList.remove('hidden');

    // Mock tokens for demo — replace with actual API call when LiveKit is set up
    document.getElementById('patient-token').value   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
    document.getElementById('clinician-token').value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
}

// ── Copy token functionality ──────────────────────────────────────────
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId  = btn.dataset.target;
        const textarea  = document.getElementById(targetId);
        textarea.select();
        document.execCommand('copy');

        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
});

// ── Tab switching ─────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`${tab}-tab`).classList.add('active');
    });
});

// ── Speaker filter ────────────────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        filterTranscript(filter);
    });
});

// ── Search functionality ──────────────────────────────────────────────
document.getElementById('search-btn')?.addEventListener('click', performSearch);

async function performSearch() {
    const query      = document.getElementById('search-query').value;
    const activeMode = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';

    if (!query) return;

    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<p>⏳ Searching...</p>';

    try {
        const res = await fetch(`${API_URL}/retrieve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, mode: activeMode, k: 5 }),
        });

        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        displaySearchResults(data.results, query);

    } catch (err) {
        resultsDiv.innerHTML = `<p>❌ Search failed: ${err.message}</p>`;
    }
}

function displaySearchResults(results, query) {
    const resultsDiv = document.getElementById('search-results');

    if (!results || results.length === 0) {
        resultsDiv.innerHTML = `<p>No results found for "${query}"</p>`;
        return;
    }

    resultsDiv.innerHTML = `<h4>Results for: "${query}"</h4>`;

    results.forEach((result) => {
        const div       = document.createElement('div');
        div.className   = `result-item ${result.role.toLowerCase()}`;
        div.innerHTML   = `
            <span class="speaker-label">${result.role}:</span>
            <span class="message-text">${result.text}</span>
            <span class="timestamp">${result.start_time.toFixed(1)}s – ${result.end_time.toFixed(1)}s</span>
            <small>Similarity: ${result.similarity.toFixed(3)}</small>
        `;
        resultsDiv.appendChild(div);
    });
}

// ── Helper functions ──────────────────────────────────────────────────
function showResults() {
    document.getElementById('results').classList.remove('hidden');
}

function displayTranscript(transcript) {
    const content = document.getElementById('transcript-content');
    content.innerHTML = '';

    transcript.forEach(line => {
        const div       = document.createElement('div');
        div.className   = `transcript-line ${line.role.toLowerCase()}`;
        div.dataset.speaker = line.role;
        div.innerHTML   = `
            <span class="timestamp">${line.start.toFixed(1)}s</span>
            <span class="speaker-label">${line.role}:</span>
            <span class="message-text">${line.text}</span>
        `;
        content.appendChild(div);
    });
}

function filterTranscript(filter) {
    const lines = document.querySelectorAll('.transcript-line');
    lines.forEach(line => {
        if (filter === 'all') {
            line.style.display = 'block';
        } else {
            const speaker = line.dataset.speaker.toLowerCase();
            line.style.display = speaker === filter ? 'block' : 'none';
        }
    });
}

function formatMarkdown(text) {
    // Convert **bold** to <strong>
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert bullet points to proper list items
    const lines = text.split('\n');
    let result = '';
    let inList = false;

    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            if (!inList) {
                result += '<ul style="margin-left: 20px; margin-top: 8px; margin-bottom: 8px;">';
                inList = true;
            }
            result += `<li style="margin-bottom: 6px;">${trimmed.substring(2)}</li>`;
        } else {
            if (inList) {
                result += '</ul>';
                inList = false;
            }
            if (trimmed === '') {
                result += '<br>';
            } else {
                result += `${trimmed}<br>`;
            }
        }
    });

    if (inList) result += '</ul>';
    return result;
}

function displayAnalysis(analysis) {
    const content = document.getElementById('analysis-content');
    content.innerHTML = `
        <div class="analysis-section">
            <h3>📋 Clinical Summary</h3>
            <p>${formatMarkdown(analysis.summary)}</p>
        </div>
        <div class="analysis-section">
            <h3>🩺 Symptom Q&A</h3>
            <p>${formatMarkdown(analysis.symptom_qa)}</p>
        </div>
        <div class="analysis-section">
            <h3>📊 Interview Quality</h3>
            <p>${formatMarkdown(analysis.quality)}</p>
        </div>
        <div class="analysis-section">
            <h3>🏥 Referral Recommendation</h3>
            <p>${formatMarkdown(analysis.referral)}</p>
        </div>
        <div class="analysis-section">
            <h3>❓ Follow-Up Questions</h3>
            <p>${formatMarkdown(analysis.followup)}</p>
        </div>
    `;
}
