import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { WebSocketServer } from 'ws';
import http from 'http';
import { DockerService } from './services/docker';

const app = express();
const PORT = 8080;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Initialize Docker service
const dockerService = new DockerService();

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Send initial stats
  dockerService.getContainerStats().then((stats) => {
    ws.send(JSON.stringify({ type: 'initial', data: stats }));
  });

  // Subscribe to Docker events
  const eventHandler = (event: any) => {
    ws.send(JSON.stringify({ type: 'event', data: event }));
  };

  dockerService.on('containerEvent', eventHandler);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    dockerService.off('containerEvent', eventHandler);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// REST API endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await dockerService.getContainerStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch container stats' });
  }
});

app.get('/api/container/:id', async (req, res) => {
  try {
    const details = await dockerService.getContainerDetails(req.params.id);
    res.json(details);
  } catch (error) {
    console.error('Error fetching container details:', error);
    res.status(500).json({ error: 'Failed to fetch container details' });
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`Mission Control API running on port ${PORT}`);
  dockerService.startEventStream();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    dockerService.stopEventStream();
    process.exit(0);
  });
});
