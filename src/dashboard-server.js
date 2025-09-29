const WebSocket = require('ws');

class DashboardServer {
  constructor(config) {
    this.metrics = config.metrics;
    this.oauthManager = config.oauthManager;
    this.wss = null;
    this.updateInterval = null;
  }

  start(server) {
    // Create WebSocket server
    this.wss = new WebSocket.Server({ noServer: true });

    // Handle WebSocket upgrade on the HTTP server
    server.on('upgrade', (request, socket, head) => {
      if (request.url === '/ws') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    // Handle WebSocket connections
    this.wss.on('connection', (ws) => {
      console.log('Dashboard client connected');

      // Send initial data
      this.sendUpdate(ws);

      // Handle client messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          } else if (data.type === 'reset-metrics') {
            this.metrics.reset();
            this.broadcastUpdate();
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('Dashboard client disconnected');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    // Start periodic updates
    this.startUpdateLoop();
  }

  startUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Send updates every 2 seconds
    this.updateInterval = setInterval(() => {
      this.broadcastUpdate();
    }, 2000);
  }

  sendUpdate(ws) {
    if (ws.readyState === WebSocket.OPEN) {
      const update = this.getUpdateData();
      ws.send(JSON.stringify(update));
    }
  }

  broadcastUpdate() {
    if (!this.wss) return;

    const update = this.getUpdateData();
    const message = JSON.stringify(update);

    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  getUpdateData() {
    return {
      type: 'update',
      timestamp: new Date().toISOString(),
      metrics: this.metrics.getMetrics(),
      oauth: {
        hasToken: this.oauthManager.hasValidToken(),
        nextRefresh: this.oauthManager.getNextRefreshTime()
      },
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

module.exports = { DashboardServer };