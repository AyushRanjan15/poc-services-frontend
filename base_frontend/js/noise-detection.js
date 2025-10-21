/**
 * Noise Detection Application
 * Coordinates audio processing, WebSocket communication, and UI updates
 */

// Application state
const detectionApp = {
    audioProcessor: null,
    wsClient: null,
    noiseDetector: null,
    frameCount: 0,
    isRunning: false,
    currentDisplayState: null,
    stateFrameCount: 0,
    stateChangeThreshold: 3
};

// DOM elements - will be initialized when tab is active
let detectionElements = {};

/**
 * Initialize detection elements
 */
function initDetectionElements() {
    console.log('Initializing detection elements...');
    detectionElements = {
        startBtn: document.getElementById('startDetectionBtn'),
        stopBtn: document.getElementById('stopDetectionBtn'),
        statusIndicator: document.getElementById('indicatorImage'),
        statusText: document.getElementById('statusText'),
        confidenceText: document.getElementById('confidenceText'),
        connectionStatus: document.getElementById('connectionStatus'),
        frameCount: document.getElementById('frameCount'),
        logContainer: document.getElementById('logContainer')
    };
    console.log('Detection elements initialized:', Object.keys(detectionElements).filter(k => detectionElements[k]).length + ' elements found');
}

/**
 * Initialize the noise detection application
 */
function initNoiseDetection() {
    console.log('Starting noise detection initialization...');

    try {
        initDetectionElements();

        // Initialize components
        console.log('Creating AudioProcessor and NoiseDetector...');
        detectionApp.audioProcessor = new AudioProcessor(40); // 40ms frames
        detectionApp.noiseDetector = new NoiseDetector(4); // 4-frame moving average

        // Set up event listeners
        if (detectionElements.startBtn) {
            console.log('Setting up start button listener');
            detectionElements.startBtn.addEventListener('click', startDetection);
        } else {
            console.error('Start button not found!');
        }

        if (detectionElements.stopBtn) {
            console.log('Setting up stop button listener');
            detectionElements.stopBtn.addEventListener('click', stopDetection);
        } else {
            console.error('Stop button not found!');
        }

        // Add initial log
        addDetectionLog('Application initialized', 'info');
        console.log('Noise detection initialization complete');
    } catch (error) {
        console.error('Error during initialization:', error);
    }
}

/**
 * Start noise detection
 */
async function startDetection() {
    try {
        addDetectionLog('Starting noise detection...', 'info');

        // Disable start button
        if (detectionElements.startBtn) detectionElements.startBtn.disabled = true;

        // Initialize WebSocket connection
        const wsUrl = Config.WEBSOCKET_URL;
        addDetectionLog(`Connecting to: ${wsUrl}`, 'info');
        detectionApp.wsClient = new WebSocketClient({ wsUrl });

        // Set up WebSocket callbacks
        detectionApp.wsClient.onConnected = onWebSocketConnected;
        detectionApp.wsClient.onDisconnected = onWebSocketDisconnected;
        detectionApp.wsClient.onNoiseDetection = onNoiseDetectionResult;
        detectionApp.wsClient.onError = onWebSocketError;

        // Connect to WebSocket
        try {
            await detectionApp.wsClient.connect();
        } catch (error) {
            addDetectionLog('WebSocket connection failed - running in demo mode', 'info');
        }

        // Start audio capture
        const audioInfo = await detectionApp.audioProcessor.start();
        addDetectionLog(`Audio capture started: ${audioInfo.sampleRate}Hz, ${audioInfo.frameSize}ms frames`, 'success');

        // Set up audio frame callback
        detectionApp.audioProcessor.onAudioFrame = onAudioFrame;

        // Update UI
        detectionApp.isRunning = true;
        if (detectionElements.stopBtn) detectionElements.stopBtn.disabled = false;
        if (detectionElements.statusText) detectionElements.statusText.textContent = 'Listening...';
        if (detectionElements.statusIndicator) detectionElements.statusIndicator.classList.add('processing');
        updateConnectionStatus();

    } catch (error) {
        addDetectionLog(`Error starting detection: ${error.message}`, 'error');
        if (detectionElements.startBtn) detectionElements.startBtn.disabled = false;
        console.error(error);
    }
}

/**
 * Stop noise detection
 */
function stopDetection() {
    addDetectionLog('Stopping noise detection...', 'info');

    // Stop audio processing
    if (detectionApp.audioProcessor) {
        detectionApp.audioProcessor.stop();
    }

    // Disconnect WebSocket
    if (detectionApp.wsClient) {
        detectionApp.wsClient.disconnect();
    }

    // Reset noise detector
    if (detectionApp.noiseDetector) {
        detectionApp.noiseDetector.reset();
    }

    // Reset state
    detectionApp.isRunning = false;
    detectionApp.frameCount = 0;
    detectionApp.currentDisplayState = null;
    detectionApp.stateFrameCount = 0;

    // Update UI
    if (detectionElements.startBtn) detectionElements.startBtn.disabled = false;
    if (detectionElements.stopBtn) detectionElements.stopBtn.disabled = true;
    if (detectionElements.statusText) detectionElements.statusText.textContent = 'Not Connected';
    if (detectionElements.confidenceText) detectionElements.confidenceText.textContent = 'Confidence: --';

    if (detectionElements.statusIndicator) {
        detectionElements.statusIndicator.classList.remove('processing', 'clean', 'noisy');
        detectionElements.statusIndicator.src = 'assets/no_peech.png';
        detectionElements.statusIndicator.style.opacity = '1';
    }

    if (detectionElements.frameCount) detectionElements.frameCount.textContent = '0';
    updateConnectionStatus();

    addDetectionLog('Detection stopped', 'info');
}

/**
 * Handle audio frame from processor
 */
function onAudioFrame(frameData) {
    detectionApp.frameCount++;
    if (detectionElements.frameCount) {
        detectionElements.frameCount.textContent = detectionApp.frameCount;
    }

    // Send to WebSocket if connected
    if (detectionApp.wsClient && detectionApp.wsClient.isConnected) {
        detectionApp.wsClient.sendAudioFrame(frameData);
    } else {
        // Demo mode: simulate noise detection locally
        simulateNoiseDetection();
    }
}

/**
 * Handle noise detection result from backend
 */
function onNoiseDetectionResult(result) {
    // Apply temporal smoothing
    const smoothed = detectionApp.noiseDetector.addDetection(result.isNoisy, result.confidence);

    // Update UI
    updateNoiseStatus(smoothed.isNoisy, smoothed.confidence, result.vad_probability);
}

/**
 * Update noise status in UI
 */
function updateNoiseStatus(isNoisy, confidence, vadProbability) {
    const desiredState = isNoisy ? 'no-speech' : 'speech';

    // Check if state has changed
    if (detectionApp.currentDisplayState !== desiredState) {
        detectionApp.stateFrameCount++;

        // Only switch display if we've seen consistent state for threshold frames
        if (detectionApp.stateFrameCount >= detectionApp.stateChangeThreshold) {
            detectionApp.currentDisplayState = desiredState;
            detectionApp.stateFrameCount = 0;

            const newImageSrc = isNoisy ? 'assets/no_peech.png' : 'assets/speech.gif';

            if (detectionElements.statusIndicator) {
                const currentImageSrc = detectionElements.statusIndicator.src;

                if (!currentImageSrc.endsWith(newImageSrc)) {
                    detectionElements.statusIndicator.style.opacity = '0';

                    setTimeout(() => {
                        detectionElements.statusIndicator.src = newImageSrc;
                        detectionElements.statusIndicator.style.opacity = '1';
                    }, 200);
                }

                detectionElements.statusIndicator.classList.remove('processing', 'clean', 'noisy');
                detectionElements.statusIndicator.classList.add(isNoisy ? 'noisy' : 'clean');
            }

            const statusLabel = isNoisy ? 'No Speech / Noise' : 'Speech Detected';
            if (detectionElements.statusText) {
                detectionElements.statusText.textContent = statusLabel;
            }
        }
    } else {
        detectionApp.stateFrameCount = 0;
    }

    // Always update confidence text
    if (detectionElements.confidenceText) {
        if (vadProbability !== undefined) {
            detectionElements.confidenceText.textContent = `Speech Probability: ${(vadProbability * 100).toFixed(1)}%`;
        } else {
            detectionElements.confidenceText.textContent = `Confidence: ${(confidence * 100).toFixed(1)}%`;
        }
    }

    // Log significant changes
    if (detectionApp.frameCount % 50 === 0) {
        const statusLabel = isNoisy ? 'No Speech / Noise' : 'Speech Detected';
        const probText = vadProbability !== undefined ?
            `VAD: ${(vadProbability * 100).toFixed(1)}%` :
            `Conf: ${(confidence * 100).toFixed(1)}%`;
        addDetectionLog(`Frame ${detectionApp.frameCount}: ${statusLabel} (${probText})`, 'info');
    }
}

/**
 * Simulate noise detection for demo mode
 */
function simulateNoiseDetection() {
    const isNoisy = Math.random() > 0.7;
    const confidence = 0.6 + Math.random() * 0.3;
    onNoiseDetectionResult({ isNoisy, confidence, timestamp: Date.now() });
}

/**
 * WebSocket event handlers
 */
function onWebSocketConnected() {
    addDetectionLog('Connected to backend', 'success');
    updateConnectionStatus();
}

function onWebSocketDisconnected() {
    addDetectionLog('Disconnected from backend', 'info');
    updateConnectionStatus();
}

function onWebSocketError(error) {
    addDetectionLog(`WebSocket error: ${error.message}`, 'error');
}

/**
 * Update connection status display
 */
function updateConnectionStatus() {
    if (!detectionElements.connectionStatus) return;

    if (detectionApp.wsClient && detectionApp.wsClient.isConnected) {
        detectionElements.connectionStatus.textContent = 'Connected';
        detectionElements.connectionStatus.style.color = '#28a745';
    } else if (detectionApp.isRunning) {
        detectionElements.connectionStatus.textContent = 'Demo Mode';
        detectionElements.connectionStatus.style.color = '#ffc107';
    } else {
        detectionElements.connectionStatus.textContent = 'Disconnected';
        detectionElements.connectionStatus.style.color = '#6c757d';
    }
}

/**
 * Add log entry to UI
 */
function addDetectionLog(message, type = 'info') {
    if (!detectionElements.logContainer) return;

    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] ${message}`;

    detectionElements.logContainer.appendChild(logEntry);

    // Auto-scroll to bottom
    detectionElements.logContainer.scrollTop = detectionElements.logContainer.scrollHeight;

    // Limit log entries
    while (detectionElements.logContainer.children.length > 100) {
        detectionElements.logContainer.removeChild(detectionElements.logContainer.firstChild);
    }

    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the noise detection page by looking for the button
    const startBtn = document.getElementById('startDetectionBtn');
    if (startBtn) {
        // Delay initialization to ensure all scripts are loaded
        setTimeout(initNoiseDetection, 100);
    }
});
