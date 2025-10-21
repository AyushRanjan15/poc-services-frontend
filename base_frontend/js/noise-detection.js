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
    currentDisplayState: null, // 'speech' or 'no-speech'
    consecutiveFrames: 0, // Count of consecutive frames in the SAME new state
    stateChangeThreshold: 5 // Number of consecutive frames needed to change state
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
    detectionApp.consecutiveFrames = 0;

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
    // Backend returns: isNoisy = true means noise/no-speech, isNoisy = false means clean speech
    // We need to invert this: isSpeech = NOT isNoisy
    const isSpeech = !result.isNoisy;

    // Apply temporal smoothing
    const smoothed = detectionApp.noiseDetector.addDetection(isSpeech, result.confidence);

    // Update UI - smoothed.isNoisy is actually smoothed.isSpeech now after our change
    updateNoiseStatus(smoothed.isNoisy, smoothed.confidence, result.vad_probability);
}

/**
 * Update noise status in UI
 * Logic: High probability/confidence = SPEECH, Low probability/confidence = NO SPEECH
 */
function updateNoiseStatus(isSpeech, confidence, vadProbability) {
    // Determine desired state based on speech detection
    // isSpeech should be true when model confidence is HIGH (speech detected)
    // isSpeech should be false when model confidence is LOW (no speech / noise)
    const desiredState = isSpeech ? 'speech' : 'no-speech';

    // Initialize state on first frame
    if (detectionApp.currentDisplayState === null) {
        detectionApp.currentDisplayState = desiredState;
        updateIndicatorDisplay(desiredState);
    }

    // Check if this frame matches the desired new state (different from current)
    if (detectionApp.currentDisplayState !== desiredState) {
        // This frame wants to change state - increment consecutive counter
        detectionApp.consecutiveFrames++;

        // Only switch display if we've seen N CONSECUTIVE frames in the new state
        if (detectionApp.consecutiveFrames >= detectionApp.stateChangeThreshold) {
            // Change the state
            detectionApp.currentDisplayState = desiredState;
            detectionApp.consecutiveFrames = 0;
            updateIndicatorDisplay(desiredState);

            const statusLabel = isSpeech ? 'Speech Detected' : 'No Speech / Noise';
            if (detectionElements.statusText) {
                detectionElements.statusText.textContent = statusLabel;
            }

            // Log state change
            addDetectionLog(`State changed to: ${statusLabel}`, 'success');
        }
    } else {
        // This frame matches current state - reset consecutive counter
        detectionApp.consecutiveFrames = 0;
    }

    // Always update confidence text
    if (detectionElements.confidenceText) {
        if (vadProbability !== undefined) {
            detectionElements.confidenceText.textContent = `Speech Probability: ${(vadProbability * 100).toFixed(1)}%`;
        } else {
            detectionElements.confidenceText.textContent = `Confidence: ${(confidence * 100).toFixed(1)}%`;
        }
    }

    // Log periodic updates
    if (detectionApp.frameCount % 50 === 0) {
        const statusLabel = isSpeech ? 'Speech Detected' : 'No Speech / Noise';
        const probText = vadProbability !== undefined ?
            `VAD: ${(vadProbability * 100).toFixed(1)}%` :
            `Conf: ${(confidence * 100).toFixed(1)}%`;
        addDetectionLog(`Frame ${detectionApp.frameCount}: ${statusLabel} (${probText})`, 'info');
    }
}

/**
 * Update the indicator image and styling
 */
function updateIndicatorDisplay(state) {
    if (!detectionElements.statusIndicator) return;

    const newImageSrc = state === 'speech' ? 'assets/speech.gif' : 'assets/no_peech.png';
    const currentImageSrc = detectionElements.statusIndicator.src;

    // Only update if image needs to change
    if (!currentImageSrc.endsWith(newImageSrc)) {
        // Smooth fade transition
        detectionElements.statusIndicator.style.opacity = '0';

        setTimeout(() => {
            detectionElements.statusIndicator.src = newImageSrc;
            detectionElements.statusIndicator.style.opacity = '1';
        }, 200);
    }

    // Update CSS classes
    detectionElements.statusIndicator.classList.remove('processing', 'clean', 'noisy');
    detectionElements.statusIndicator.classList.add(state === 'speech' ? 'clean' : 'noisy');
}

/**
 * Simulate noise detection for demo mode (when backend is unavailable)
 * Note: This is just for demonstration - real detection comes from backend
 */
function simulateNoiseDetection() {
    // Simulate more realistic speech patterns: 50/50 chance
    const isNoisy = Math.random() > 0.5;
    // Vary confidence more realistically (0.5 to 0.95)
    const confidence = 0.5 + Math.random() * 0.45;

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
