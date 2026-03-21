// Mode switching
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const mode = btn.dataset.mode;
        document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`${mode}-mode`).classList.add('active');
    });
});

// File upload handling
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight drop area on drag
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

// Handle dropped files
dropArea.addEventListener('drop', handleDrop, false);
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFiles);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles({ target: { files } });
}

function handleFiles(e) {
    const files = e.target.files;
    if (files.length) {
        const file = files[0];
        fileName.textContent = file.name;
        fileInfo.classList.remove('hidden');
        
        // Auto-process for demo
        setTimeout(() => {
            processInterview(file);
        }, 500);
    }
}

// Process interview
document.getElementById('process-btn')?.addEventListener('click', () => {
    const file = fileInput.files[0];
    if (file) processInterview(file);
});

async function processInterview(file) {
    showResults();
    
    // Show loading state
    document.getElementById('transcript-content').innerHTML = '<p>Processing audio...</p>';
    
    // Simulate processing (replace with actual API call)
    setTimeout(() => {
        const mockTranscript = generateMockTranscript();
        displayTranscript(mockTranscript);
        displayAnalysis(mockTranscript);
    }, 2000);
}

// Generate tokens for LiveKit
document.getElementById('generate-tokens-btn')?.addEventListener('click', generateTokens);

async function generateTokens() {
    const tokensDiv = document.getElementById('tokens-display');
    tokensDiv.classList.remove('hidden');
    
    // Mock tokens for demo (replace with actual API call)
    document.getElementById('patient-token').value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
    document.getElementById('clinician-token').value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
}

// Copy token functionality
document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const textarea = document.getElementById(targetId);
        textarea.select();
        document.execCommand('copy');
        
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`${tab}-tab`).classList.add('active');
    });
});

// Speaker filter
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const filter = btn.dataset.filter;
        filterTranscript(filter);
    });
});

// Search functionality
document.getElementById('search-btn')?.addEventListener('click', performSearch);

async function performSearch() {
    const query = document.getElementById('search-query').value;
    if (!query) return;
    
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '<p>Searching...</p>';
    
    // Mock search results (replace with actual API call)
    setTimeout(() => {
        resultsDiv.innerHTML = `
            <div class="search-result">
                <h4>Results for: "${query}"</h4>
                <div class="result-item">
                    <span class="speaker-label">PATIENT:</span>
                    <span>I have a headache for three days</span>
                    <span class="timestamp">[14:35:22]</span>
                </div>
                <div class="result-item">
                    <span class="speaker-label">CLINICIAN:</span>
                    <span>Any other symptoms?</span>
                    <span class="timestamp">[14:35:27]</span>
                </div>
                <p><small>Precision@5: 0.85 | Recall@5: 0.78</small></p>
            </div>
        `;
    }, 1000);
}

// Helper functions
function showResults() {
    document.getElementById('results').classList.remove('hidden');
}

function generateMockTranscript() {
    return [
        { speaker: 'PATIENT', text: 'Hello doctor, I have a headache.', time: '14:35:22' },
        { speaker: 'CLINICIAN', text: 'How long has this been going on?', time: '14:35:24' },
        { speaker: 'PATIENT', text: 'About three days now.', time: '14:35:27' },
        { speaker: 'CLINICIAN', text: 'Any other symptoms like fever or nausea?', time: '14:35:30' },
        { speaker: 'PATIENT', text: 'No fever, but I feel a bit nauseous.', time: '14:35:33' },
        { speaker: 'CLINICIAN', text: 'Have you taken any medication?', time: '14:35:36' },
        { speaker: 'PATIENT', text: 'I took some ibuprofen yesterday.', time: '14:35:39' }
    ];
}

function displayTranscript(transcript) {
    const content = document.getElementById('transcript-content');
    content.innerHTML = '';
    
    transcript.forEach(line => {
        const div = document.createElement('div');
        div.className = `transcript-line ${line.speaker.toLowerCase()}`;
        div.dataset.speaker = line.speaker;
        div.innerHTML = `
            <span class="timestamp">[${line.time}]</span>
            <span class="speaker-label">${line.speaker}:</span>
            <span>${line.text}</span>
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

function displayAnalysis(transcript) {
    const content = document.getElementById('analysis-content');
    content.innerHTML = `
        <h3>Interview Summary</h3>
        <p>Total utterances: ${transcript.length}</p>
        <p>Patient: ${transcript.filter(l => l.speaker === 'PATIENT').length} turns</p>
        <p>Clinician: ${transcript.filter(l => l.speaker === 'CLINICIAN').length} turns</p>
        
        <h4>Key Symptoms Mentioned:</h4>
        <ul>
            <li>Headache (duration: 3 days)</li>
            <li>Nausea (no fever)</li>
        </ul>
        
        <h4>Medications Discussed:</h4>
        <ul>
            <li>Ibuprofen (taken yesterday)</li>
        </ul>
        
        <h4>Clinician Questions:</h4>
        <ul>
            <li>Duration of symptoms</li>
            <li>Associated symptoms (fever, nausea)</li>
            <li>Medication history</li>
        </ul>
    `;
}