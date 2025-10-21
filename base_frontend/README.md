# Redenlab Intelligence Suite

A unified web application featuring three advanced audio analysis tools with a sleek, modern black-themed interface and intuitive navigation.

## Features

### Home Page
- Animated Redenlab logo (intro.gif)
- Slide-out hamburger menu navigation
- Clean, minimalist black design
- Smooth transitions and accessibility features

### Service Pages

#### 1. Noise Meter
- Real-time audio level monitoring with visual gauge
- Semicircle gauge display (0-100 dB)
- Color-coded quality indicators (Quiet/Moderate/Noisy/Too loud)
- Visual bar and numeric readout
- Microphone-based audio capture

#### 2. Speech Analysis
- Upload single or multiple audio files
- Folder upload support
- Direct microphone recording
- Intelligibility analysis for speech disorders
- ALS analysis support (other disorders coming soon)
- Results export to CSV format

#### 3. Noise Detection
- Real-time background noise vs. speech detection
- Visual speech indicators with smooth animations
- WebSocket-based ML inference (with demo mode fallback)
- Confidence scoring and activity logging
- Frame-by-frame processing metrics

## Setup & Usage

### Quick Start

1. **Using Python's built-in HTTP server:**
   ```bash
   cd /Users/ayushranjan/Documents/Redenlab/Git_projects/frontend-demo/base_frontend
   python3 -m http.server 8000
   ```
   Then open http://localhost:8000 in your browser.

2. **Using Node.js http-server:**
   ```bash
   npx http-server -p 8000
   ```
   Then open http://localhost:8000 in your browser.

3. **Using Live Server (VS Code extension):**
   - Install the Live Server extension in VS Code
   - Right-click on index.html and select "Open with Live Server"

### Navigation

- **Home Page**: Features the Redenlab animated logo with hamburger menu access
- **Menu**: Click the hamburger icon (top-right) to access all services
- **Back to Home**: Each service page has a "Home" button (top-left)
- **Keyboard Shortcuts**: Press `ESC` on any service page to return home

## File Structure

```
base_frontend/
├── index.html                  # Home page with slide-out menu
├── noise-meter.html           # Real-time dB monitoring
├── speech-analysis.html       # Speech intelligibility analysis
├── noise-detection.html       # Background noise detection
├── README.md                  # This file
│
├── css/                       # Stylesheets
│   ├── speech-analysis.css    # Speech analysis styles
│   └── noise-detection.css    # Noise detection styles
│
├── js/                        # JavaScript modules
│   ├── speech-analysis.js     # Speech analysis logic
│   ├── noise-detection.js     # Noise detection app
│   ├── config.js              # Configuration
│   ├── audioProcessor.js      # Audio processing utilities
│   ├── noiseDetector.js       # Noise detection algorithms
│   └── websocketClient.js     # WebSocket communication
│
└── assets/                    # Media files
    ├── intro.gif              # Redenlab animated logo
    ├── logo.png               # Redenlab static logo
    ├── no_peech.png           # No speech indicator
    └── speech.gif             # Speech detected animation
```

## Design

### Visual Theme
- **Background**: Pure black (#000)
- **Cards**: Dark grey (#0d0d0f) with subtle borders (#222)
- **Text**: Light grey (#e8e8ea)
- **Accent**: Blue (#7aa7ff)
- **Consistent topbar** across all service pages

### UI Components
- **Slide-out Navigation**: Smooth right-side menu with backdrop
- **Topbar**: Sticky header with "Home" button and page title
- **Cards**: Consistent bordered containers for all content
- **Buttons**: Hover effects and disabled states
- **Responsive Design**: Mobile-friendly layouts

## Configuration

### Speech Analysis API
Edit `js/speech-analysis.js` to update the API endpoint:
```javascript
// Line 44
apiUrl = 'https://your-api-endpoint.execute-api.us-west-2.amazonaws.com/prod/predict';
```

### Noise Detection WebSocket
Edit `js/config.js` to update the WebSocket URL:
```javascript
const Config = {
    WEBSOCKET_URL: 'wss://your-websocket-endpoint.amazonaws.com/prod'
};
```

## Browser Requirements

- Modern browser with:
  - Web Audio API support
  - ES6+ JavaScript
  - CSS Grid and Flexbox
  - WebSocket support (for Noise Detection)
- Microphone access (for real-time features)
- JavaScript enabled

## Service Details

### Noise Meter
- **No backend required** - runs entirely in browser
- Uses Web Audio API for microphone access
- Real-time processing with 50ms refresh rate
- Gauge responds to audio levels instantly

### Speech Analysis
- **Requires backend API** for processing
- Supports WAV, MP3, M4A formats
- Can process single files or entire folders
- Recording feature uses MediaRecorder API
- Results can be downloaded as CSV

### Noise Detection
- **Can run in demo mode** without backend
- WebSocket connection for real-time ML inference
- Falls back to simulated detection if WebSocket unavailable
- Temporal smoothing for stable visual feedback
- Activity logging for debugging

## Development Notes

### Architecture
This unified application was created by merging three separate frontends:
1. `base_frontend` - Original noise meter with decibel gauge
2. `frontend_ml_api` - Speech analysis interface
3. `frontend_speech_detector` - Background noise detection

All services now share:
- Consistent black theme design
- Common navigation pattern (from `RL_Intelligence_Demo`)
- Unified branding
- Responsive layouts

### Page Structure
Each service page follows the same pattern:
```html
<!-- Topbar with Home button -->
<header class="topbar">
  <a href="index.html">Home</a>
  <span>Service Name</span>
</header>

<!-- Content in cards -->
<main class="container">
  <section class="card">
    <!-- Service content -->
  </section>
</main>
```

## Keyboard Shortcuts

- `ESC` - Return to home page (from any service page)
- `ESC` - Close navigation menu (on home page)

## Accessibility

- ARIA labels on interactive elements
- Focus states on all buttons and links
- Keyboard navigation support
- Semantic HTML structure
- Alt text on images

## License

© Redenlab - All Rights Reserved
