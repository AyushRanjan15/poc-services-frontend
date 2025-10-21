// Global variables
let selectedFiles = [];
let analysisResults = [];
let apiUrl = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let currentlyPlayingAudio = null;
let audioProgressIntervals = new Map();

// DOM elements
const uploadTypeRadios = document.querySelectorAll('input[name="uploadType"]');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const singleUploadArea = document.getElementById('singleUploadArea');
const folderUploadArea = document.getElementById('folderUploadArea');
const recordUploadArea = document.getElementById('recordUploadArea');
const recordingControls = document.getElementById('recordingControls');
const startRecordBtn = document.getElementById('startRecordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const recordingStatus = document.getElementById('recordingStatus');
const selectedFilesDiv = document.getElementById('selectedFiles');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.querySelector('.btn-text');
const btnLoading = document.querySelector('.btn-loading');
const resultsSection = document.getElementById('resultsSection');
const resultsContainer = document.getElementById('resultsContainer');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    fetchApiUrl();
});

// Get API URL from CloudFormation (similar to your test script)
async function fetchApiUrl() {
    try {
        // For POC, we'll need to set this manually or use a simple backend
        // This would typically require AWS SDK which can't run in browser
        console.log('API URL will need to be configured manually or via backend');

        // For now, let's use a placeholder - user will need to update this
        apiUrl = 'https://s1pfsycdb6.execute-api.us-west-2.amazonaws.com/prod/predict';

        // You can uncomment this line and set your actual API URL for testing
        // apiUrl = 'https://actual-api-url-here.execute-api.us-west-2.amazonaws.com/prod/predict';

    } catch (error) {
        console.error('Error fetching API URL:', error);
    }
}

// Initialize event listeners
function initializeEventListeners() {
    // Upload type radio buttons
    uploadTypeRadios.forEach(radio => {
        radio.addEventListener('change', handleUploadTypeChange);
    });

    // File inputs
    fileInput.addEventListener('change', handleFileSelection);
    folderInput.addEventListener('change', handleFolderSelection);

    // Upload areas click handlers
    singleUploadArea.addEventListener('click', () => {
        if (document.getElementById('singleFile').checked) {
            fileInput.click();
        }
    });

    folderUploadArea.addEventListener('click', () => {
        if (document.getElementById('multipleFiles').checked) {
            folderInput.click();
        }
    });

    recordUploadArea.addEventListener('click', () => {
        if (document.getElementById('recordAudio').checked) {
            setupRecording();
        }
    });

    // Drag and drop handlers
    setupDragAndDrop(singleUploadArea, fileInput);
    setupDragAndDrop(folderUploadArea, folderInput);

    // Form submission
    document.getElementById('analysisForm').addEventListener('submit', handleFormSubmission);

    // Download CSV
    downloadCsvBtn.addEventListener('click', downloadResultsCSV);

    // Recording controls
    startRecordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
}

// Handle upload type change
function handleUploadTypeChange() {
    const selectedType = document.querySelector('input[name="uploadType"]:checked').value;

    // Reset all areas
    singleUploadArea.classList.add('disabled');
    folderUploadArea.classList.add('disabled');
    recordUploadArea.classList.add('disabled');
    recordingControls.style.display = 'none';

    // Enable selected area
    if (selectedType === 'single') {
        singleUploadArea.classList.remove('disabled');
        folderInput.value = '';
    } else if (selectedType === 'multiple') {
        folderUploadArea.classList.remove('disabled');
        fileInput.value = '';
    } else if (selectedType === 'record') {
        recordUploadArea.classList.remove('disabled');
        fileInput.value = '';
        folderInput.value = '';
    }

    selectedFiles = [];
    updateSelectedFilesDisplay();
    updateSubmitButton();
}

// Setup drag and drop functionality
function setupDragAndDrop(area, input) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        area.addEventListener(eventName, () => {
            if (!area.classList.contains('disabled')) {
                area.classList.add('active');
            }
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        area.addEventListener(eventName, () => {
            area.classList.remove('active');
        }, false);
    });

    area.addEventListener('drop', (e) => {
        if (!area.classList.contains('disabled')) {
            const files = e.dataTransfer.files;
            handleDroppedFiles(files, input);
        }
    }, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Handle dropped files
function handleDroppedFiles(files, input) {
    // Filter for audio files
    const audioFiles = Array.from(files).filter(file =>
        file.type.startsWith('audio/') ||
        file.name.toLowerCase().endsWith('.wav') ||
        file.name.toLowerCase().endsWith('.mp3') ||
        file.name.toLowerCase().endsWith('.m4a')
    );

    if (audioFiles.length > 0) {
        // Create a new FileList-like object
        const dt = new DataTransfer();
        audioFiles.forEach(file => dt.items.add(file));
        input.files = dt.files;

        if (input === fileInput) {
            handleFileSelection();
        } else {
            handleFolderSelection();
        }
    }
}

// Handle single file selection
function handleFileSelection() {
    const files = Array.from(fileInput.files);
    selectedFiles = files.filter(file =>
        file.type.startsWith('audio/') ||
        file.name.toLowerCase().endsWith('.wav') ||
        file.name.toLowerCase().endsWith('.mp3') ||
        file.name.toLowerCase().endsWith('.m4a')
    );

    updateSelectedFilesDisplay();
    updateSubmitButton();
}

// Handle folder selection
function handleFolderSelection() {
    const files = Array.from(folderInput.files);
    selectedFiles = files.filter(file =>
        file.type.startsWith('audio/') ||
        file.name.toLowerCase().endsWith('.wav') ||
        file.name.toLowerCase().endsWith('.mp3') ||
        file.name.toLowerCase().endsWith('.m4a')
    );

    updateSelectedFilesDisplay();
    updateSubmitButton();
}

// Update selected files display
function updateSelectedFilesDisplay() {
    if (selectedFiles.length === 0) {
        selectedFilesDiv.innerHTML = '';
        return;
    }

    const filesHtml = selectedFiles.map((file, index) => `
        <div class="file-item" data-file-index="${index}">
            <div class="file-info">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l7-2v11"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <div class="audio-controls">
                <button type="button" class="play-btn" onclick="event.preventDefault(); event.stopPropagation(); toggleAudioPlayback(${index})" data-file-index="${index}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="play-icon">
                        <polygon points="5,3 19,12 5,21"></polygon>
                    </svg>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="pause-icon" style="display: none;">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                </button>
                <div class="audio-player" onclick="event.preventDefault(); event.stopPropagation(); seekAudio(event, ${index})">
                    <div class="audio-progress" id="progress-${index}"></div>
                </div>
                <div class="audio-time" id="time-${index}">0:00</div>
            </div>
        </div>
    `).join('');

    selectedFilesDiv.innerHTML = `
        <h3>Selected Files (${selectedFiles.length})</h3>
        ${filesHtml}
    `;
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Update submit button state
function updateSubmitButton() {
    const hasFiles = selectedFiles.length > 0;
    const hasApiUrl = apiUrl && apiUrl !== 'https://your-api-gateway-url.amazonaws.com/prod/predict';

    submitBtn.disabled = !hasFiles || !hasApiUrl;

    if (!hasApiUrl && hasFiles) {
        submitBtn.textContent = 'Configure API URL First';
    } else if (!hasFiles) {
        submitBtn.querySelector('.btn-text').textContent = 'Select Files First';
    } else {
        submitBtn.querySelector('.btn-text').textContent = 'Analyze Audio';
    }
}

// Handle form submission
async function handleFormSubmission(e) {
    e.preventDefault();

    if (selectedFiles.length === 0) {
        showError('Please select audio files first.');
        return;
    }

    if (!apiUrl || apiUrl === 'https://your-api-gateway-url.amazonaws.com/prod/predict') {
        showError('Please configure the API URL. See console for instructions.');
        console.log('Please update the apiUrl variable in script.js with your actual API Gateway URL.');
        return;
    }

    // Get form values
    const feature = document.querySelector('input[name="feature"]:checked').value;
    const disorder = document.getElementById('disorderSelect').value;

    // Show loading state
    setLoadingState(true);

    try {
        analysisResults = [];

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];

            // Update progress
            updateProgress(`Processing file ${i + 1}/${selectedFiles.length}: ${file.name}`);
            console.log(`Processing file ${i + 1}/${selectedFiles.length}: ${file.name}`);

            const result = await processAudioFile(file, feature, disorder);
            if (result) {
                analysisResults.push(result);
                updateProgress(`Completed ${i + 1}/${selectedFiles.length} files`);
            }
        }

        updateProgress('Analysis complete!');
        displayResults();

    } catch (error) {
        console.error('Error during analysis:', error);
        showError('An error occurred during analysis. Please try again.');
    } finally {
        setLoadingState(false);
    }
}

// Process a single audio file
async function processAudioFile(file, feature, disorder) {
    try {
        // Get audio duration first
        const duration = await getAudioDuration(file);

        // Convert audio to base64 (similar to your test script)
        const audioBase64 = await convertAudioToBase64(file);

        // Prepare payload
        const payload = {
            audio: audioBase64
        };

        // Make API request
        const startTime = performance.now();
        console.log('Making API request to:', apiUrl);
        console.log('Payload size:', JSON.stringify(payload).length, 'characters');

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const endTime = performance.now();
        const responseTime = ((endTime - startTime) / 1000).toFixed(2);

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        console.log('API response:', result);

        return {
            filename: file.name,
            duration: duration,
            responseTime: responseTime,
            feature: feature,
            disorder: disorder,
            score: result.intelligibility_score
        };

    } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        showError(`Error processing ${file.name}: ${error.message}`);
        return null;
    }
}

// Convert audio file to base64 (matching your test script approach)
async function convertAudioToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const arrayBuffer = e.target.result;

                // Create audio context
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();

                // Decode audio file
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice());

                // Get audio data and resample to 16kHz (matching your test script)
                const targetSampleRate = 16000;
                let audioData;

                if (audioBuffer.sampleRate === targetSampleRate) {
                    // Already 16kHz, just get the data
                    audioData = audioBuffer.getChannelData(0);
                } else {
                    // Resample to 16kHz
                    audioData = resampleAudio(audioBuffer.getChannelData(0), audioBuffer.sampleRate, targetSampleRate);
                }

                // Convert to base64 (matching your test script format)
                const audioBytes = new Float32Array(audioData).buffer;
                const uint8Array = new Uint8Array(audioBytes);

                // Convert to base64 string (chunked to avoid stack overflow)
                const base64 = arrayBufferToBase64(uint8Array);

                // Clean up
                audioContext.close();

                resolve(base64);

            } catch (error) {
                console.error('Audio conversion error:', error);
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Simple resampling function
function resampleAudio(audioData, originalSampleRate, targetSampleRate) {
    if (originalSampleRate === targetSampleRate) {
        return audioData;
    }

    const sampleRateRatio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(audioData.length / sampleRateRatio);
    const resampledData = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
        const originalIndex = i * sampleRateRatio;
        const index = Math.floor(originalIndex);
        const fractional = originalIndex - index;

        if (index + 1 < audioData.length) {
            // Linear interpolation
            resampledData[i] = audioData[index] * (1 - fractional) + audioData[index + 1] * fractional;
        } else {
            resampledData[i] = audioData[index] || 0;
        }
    }

    return resampledData;
}

// Convert large ArrayBuffer to base64 in chunks to avoid stack overflow
function arrayBufferToBase64(uint8Array) {
    const chunkSize = 8192; // Process in chunks to avoid stack overflow
    let binary = '';

    for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }

    return btoa(binary);
}

// Get audio duration
async function getAudioDuration(file) {
    return new Promise((resolve) => {
        const audio = new Audio();
        audio.onloadedmetadata = function() {
            resolve(audio.duration.toFixed(2));
        };
        audio.onerror = function() {
            resolve('Unknown');
        };
        audio.src = URL.createObjectURL(file);
    });
}

// Set loading state
function setLoadingState(loading) {
    if (loading) {
        btnText.style.display = 'none';
        btnLoading.style.display = 'flex';
        submitBtn.disabled = true;
    } else {
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
        submitBtn.disabled = false;
    }
}

// Display results
function displayResults() {
    console.log('Displaying results:', analysisResults);
    if (analysisResults.length === 0) {
        showError('No results to display. Check console for errors.');
        return;
    }

    const resultsHtml = analysisResults.map(result => `
        <div class="result-item">
            <div class="result-header">
                <div class="result-filename">${result.filename}</div>
                <div class="result-score">${result.score}</div>
            </div>
            <div class="result-details">
                <div class="result-detail">
                    <div class="result-detail-label">Duration</div>
                    <div class="result-detail-value">${result.duration}s</div>
                </div>
                <div class="result-detail">
                    <div class="result-detail-label">Response Time</div>
                    <div class="result-detail-value">${result.responseTime}s</div>
                </div>
                <div class="result-detail">
                    <div class="result-detail-label">Feature</div>
                    <div class="result-detail-value">${result.feature}</div>
                </div>
                <div class="result-detail">
                    <div class="result-detail-label">Disorder</div>
                    <div class="result-detail-value">${result.disorder.toUpperCase()}</div>
                </div>
            </div>
        </div>
    `).join('');

    resultsContainer.innerHTML = resultsHtml;
    resultsSection.style.display = 'block';

    // Smooth scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Download results as CSV
function downloadResultsCSV() {
    if (analysisResults.length === 0) {
        showError('No results to download.');
        return;
    }

    const headers = ['filename', 'duration', 'response_time', 'feature', 'disorder', 'score'];
    const csvContent = [
        headers.join(','),
        ...analysisResults.map(result => [
            result.filename,
            result.duration,
            result.responseTime,
            result.feature,
            result.disorder,
            result.score
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `speech_analysis_results_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Show error message
function showError(message) {
    // Remove existing error messages
    const existingErrors = document.querySelectorAll('.error');
    existingErrors.forEach(error => error.remove());

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;

    const form = document.getElementById('analysisForm');
    form.appendChild(errorDiv);

    // Remove error after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

// Show success message
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;

    const form = document.getElementById('analysisForm');
    form.appendChild(successDiv);

    // Remove success message after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

// Update progress message
function updateProgress(message) {
    const loadingSpan = document.querySelector('.btn-loading');
    if (loadingSpan && loadingSpan.style.display !== 'none') {
        const textNode = loadingSpan.childNodes[2]; // The text after the spinner
        if (textNode) {
            textNode.textContent = message;
        }
    }
}

// Audio Recording Functions
async function setupRecording() {
    try {
        recordingControls.style.display = 'flex';
        recordingStatus.textContent = 'Click "Start Recording" to begin';
    } catch (error) {
        console.error('Error setting up recording:', error);
        showError('Could not access microphone. Please check permissions.');
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        recordedChunks = [];
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            const file = new File([blob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });

            selectedFiles = [file];
            updateSelectedFilesDisplay();
            updateSubmitButton();

            // Stop all tracks to free up microphone
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;

        // Update UI
        startRecordBtn.style.display = 'none';
        stopRecordBtn.style.display = 'flex';
        recordingStatus.textContent = 'Recording... Click "Stop" when finished';
        recordingStatus.classList.add('recording');

    } catch (error) {
        console.error('Error starting recording:', error);
        showError('Could not start recording. Please check microphone permissions.');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;

        // Update UI
        startRecordBtn.style.display = 'flex';
        stopRecordBtn.style.display = 'none';
        recordingStatus.textContent = 'Recording completed!';
        recordingStatus.classList.remove('recording');
    }
}

// Audio Playback Functions
function toggleAudioPlayback(fileIndex) {
    // Prevent any form submission or event bubbling
    event.preventDefault();
    event.stopPropagation();

    const file = selectedFiles[fileIndex];
    const playBtn = document.querySelector(`[data-file-index="${fileIndex}"]`);
    const playIcon = playBtn.querySelector('.play-icon');
    const pauseIcon = playBtn.querySelector('.pause-icon');

    // Stop any currently playing audio
    if (currentlyPlayingAudio && !currentlyPlayingAudio.paused) {
        currentlyPlayingAudio.pause();
        resetAllPlayButtons();
    }

    // If clicking the same button while playing, just stop
    if (currentlyPlayingAudio && currentlyPlayingAudio.dataset.fileIndex == fileIndex && !currentlyPlayingAudio.paused) {
        currentlyPlayingAudio.pause();
        return;
    }

    // Create new audio element
    const audioUrl = URL.createObjectURL(file);
    const audio = new Audio(audioUrl);
    audio.dataset.fileIndex = fileIndex;

    // Set up event listeners
    audio.addEventListener('loadedmetadata', () => {
        updateTimeDisplay(fileIndex, 0, audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
        updateProgress(fileIndex, audio.currentTime, audio.duration);
    });

    audio.addEventListener('ended', () => {
        resetPlayButton(fileIndex);
        URL.revokeObjectURL(audioUrl);
    });

    audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        showError(`Error playing ${file.name}`);
        resetPlayButton(fileIndex);
        URL.revokeObjectURL(audioUrl);
    });

    // Start playback
    audio.play().then(() => {
        currentlyPlayingAudio = audio;
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
        playBtn.classList.add('playing');
    }).catch((error) => {
        console.error('Error starting playback:', error);
        showError(`Could not play ${file.name}`);
        URL.revokeObjectURL(audioUrl);
    });
}

function seekAudio(event, fileIndex) {
    // Prevent any form submission or event bubbling
    event.preventDefault();
    event.stopPropagation();

    if (!currentlyPlayingAudio || currentlyPlayingAudio.dataset.fileIndex != fileIndex) {
        return;
    }

    const playerRect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - playerRect.left;
    const playerWidth = playerRect.width;
    const percentage = clickX / playerWidth;

    const newTime = percentage * currentlyPlayingAudio.duration;
    currentlyPlayingAudio.currentTime = newTime;
}

function updateProgress(fileIndex, currentTime, duration) {
    const progressBar = document.getElementById(`progress-${fileIndex}`);
    const timeDisplay = document.getElementById(`time-${fileIndex}`);

    if (progressBar && timeDisplay) {
        const percentage = (currentTime / duration) * 100;
        progressBar.style.width = `${percentage}%`;

        const currentMinutes = Math.floor(currentTime / 60);
        const currentSeconds = Math.floor(currentTime % 60);
        const currentTimeString = `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')}`;

        timeDisplay.textContent = currentTimeString;
    }
}

function updateTimeDisplay(fileIndex, currentTime, duration) {
    const timeDisplay = document.getElementById(`time-${fileIndex}`);
    if (timeDisplay) {
        const durationMinutes = Math.floor(duration / 60);
        const durationSeconds = Math.floor(duration % 60);
        const durationString = `${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
        timeDisplay.textContent = `0:00 / ${durationString}`;
    }
}

function resetPlayButton(fileIndex) {
    const playBtn = document.querySelector(`[data-file-index="${fileIndex}"]`);
    if (playBtn) {
        const playIcon = playBtn.querySelector('.play-icon');
        const pauseIcon = playBtn.querySelector('.pause-icon');
        const progressBar = document.getElementById(`progress-${fileIndex}`);

        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        playBtn.classList.remove('playing');

        if (progressBar) {
            progressBar.style.width = '0%';
        }
    }
}

function resetAllPlayButtons() {
    selectedFiles.forEach((_, index) => {
        resetPlayButton(index);
    });
}