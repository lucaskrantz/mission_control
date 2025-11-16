# Mission Control 🛰️

A retro 1990s satellite-mission style dashboard that visualizes Docker containers as planets orbiting a central sun.

## Features

- **Solar System Visualization**: Each Docker container is represented as a planet with:
  - Size proportional to memory usage
  - Orbit speed based on CPU load
  - Color-coded by state (green=running, red=exited, blue=paused, yellow=restarting)
  - Glow effects for high activity

- **Retro CRT Aesthetic**:
  - Pixel fonts (VT323)
  - Scanline and vignette effects
  - Parallax starfield background
  - Occasional flicker animations

- **Real-time Updates**: WebSocket connection streams container events (start/stop/restart)

- **Interactive**: Tap/click planets to view detailed container information

## Tech Stack

- **Frontend**: React + TypeScript + PixiJS
- **Backend**: Node.js + Express + dockerode + WebSocket
- **Proxy**: Caddy
- **Deployment**: Docker Compose

## Quick Start

1. Clone this repository
2. Run the application:
   ```bash
   docker-compose up -d
   ```
3. Open your browser to `http://localhost:3000`
4. For Fire 7 tablet kiosk mode, use Fully Kiosk Browser or similar

## Requirements

- Docker and Docker Compose installed
- Access to `/var/run/docker.sock`

## Architecture

```
┌─────────────┐
│   Caddy     │ :3000
│   Proxy     │
└──────┬──────┘
       │
       ├─── /api/* ──→ Node.js API :8080
       ├─── /ws ─────→ WebSocket
       └─── /* ──────→ React App :80
```

## Performance

Optimized for Amazon Fire 7 tablet:
- Stats updates throttled to 1-2 Hz
- Limited particle effects
- Efficient PixiJS rendering

## Development

### Backend (API)
```bash
cd api
npm install
npm run dev
```

### Frontend (Web)
```bash
cd web
npm install
npm start
```

## License

MIT
