#!/usr/bin/env node

const express = require('express');
const compression = require('compression');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const { OAuthManager } = require('./oauth-manager');
const { ProxyHandler } = require('./proxy-handler');
const { DashboardServer } = require('./dashboard-server');
const { MetricsCollector } = require('./metrics');

require('dotenv').config();

class RBCCodexProxy {
  constructor() {
    this.app = express();
    this.port = process.env.PROXY_PORT || 8080;
    this.metrics = new MetricsCollector();

    // Validate configuration
    this.validateConfig();

    // Initialize components
    this.oauthManager = new OAuthManager({
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      tokenUrl: process.env.TOKEN_URL,
      certPath: path.join(__dirname, '..', 'certificates', 'rbc-ca-bundle.cer')
    });

    this.proxyHandler = new ProxyHandler({
      baseUrl: process.env.API_BASE_URL,
      oauthManager: this.oauthManager,
      metrics: this.metrics,
      certPath: path.join(__dirname, '..', 'certificates', 'rbc-ca-bundle.cer')
    });

    this.dashboardServer = new DashboardServer({
      metrics: this.metrics,
      oauthManager: this.oauthManager
    });
  }

  validateConfig() {
    const required = ['CLIENT_ID', 'CLIENT_SECRET', 'TOKEN_URL', 'API_BASE_URL'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.error(chalk.red('❌ Missing required environment variables:'));
      missing.forEach(key => console.error(chalk.red(`   - ${key}`)));
      console.error(chalk.yellow('\n📝 Please create a .env file with the required variables.'));
      console.error(chalk.yellow('   See .env.example for reference.\n'));
      process.exit(1);
    }
  }

  setupMiddleware() {
    // Enable compression for all responses
    this.app.use(compression());

    // Get size limit from environment or use default
    const sizeLimit = process.env.REQUEST_SIZE_LIMIT || '50mb';

    // Increase JSON body limit (default Express limit is 100kb)
    this.app.use(express.json({
      limit: sizeLimit,
      // Also increase parameter limit for URL-encoded bodies
      parameterLimit: 50000
    }));

    // Also handle URL-encoded bodies with increased limit
    this.app.use(express.urlencoded({
      limit: sizeLimit,
      extended: true,
      parameterLimit: 50000
    }));

    // CORS for dashboard
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      if (!req.path.startsWith('/dashboard') && !req.path.startsWith('/api/metrics')) {
        console.log(chalk.gray(`[${new Date().toISOString()}] ${req.method} ${req.path}`));
      }
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'running',
        uptime: process.uptime(),
        token_status: this.oauthManager.hasValidToken() ? 'valid' : 'expired'
      });
    });

    // Proxy endpoints
    this.app.post('/v1/chat/completions', (req, res) => this.proxyHandler.handleChatCompletion(req, res));
    this.app.post('/v1/completions', (req, res) => this.proxyHandler.handleCompletion(req, res));

    // Dashboard routes
    this.app.get('/dashboard', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
    });

    this.app.get('/api/metrics', (req, res) => {
      res.json(this.metrics.getMetrics());
    });

    this.app.get('/api/status', (req, res) => {
      res.json({
        proxy: {
          status: 'running',
          port: this.port,
          uptime: Math.floor(process.uptime())
        },
        oauth: {
          hasToken: this.oauthManager.hasValidToken(),
          nextRefresh: this.oauthManager.getNextRefreshTime()
        },
        metrics: this.metrics.getSummary()
      });
    });

    // Static files for dashboard
    this.app.use('/dashboard', express.static(path.join(__dirname, '..', 'public')));
  }

  async start() {
    console.log(chalk.cyan('\n🚀 Starting RBC Codex Proxy...\n'));

    try {
      // Initialize OAuth token
      console.log(chalk.yellow('🔐 Fetching initial OAuth token...'));
      await this.oauthManager.initialize();
      console.log(chalk.green('✅ OAuth token acquired successfully\n'));

      // Setup Express
      this.setupMiddleware();
      this.setupRoutes();

      // Start Express server and capture the HTTP server instance
      const server = this.app.listen(this.port, () => {
        this.displayStartupInfo();
      });

      // Start dashboard WebSocket server with the HTTP server
      this.dashboardServer.start(server);

    } catch (error) {
      console.error(chalk.red('❌ Failed to start proxy:'), error.message);
      process.exit(1);
    }
  }

  displayStartupInfo() {
    const table = new Table({
      style: { head: ['cyan'] }
    });

    table.push(
      [chalk.bold('Status'), chalk.green('✅ Running')],
      [chalk.bold('Proxy URL'), chalk.yellow(`http://localhost:${this.port}/v1`)],
      [chalk.bold('Dashboard'), chalk.yellow(`http://localhost:${this.port}/dashboard`)],
      [chalk.bold('API Key'), chalk.gray('Use any value (e.g., "rbc-proxy-key")')],
      [chalk.bold('Token Refresh'), chalk.gray('Every 15 minutes')]
    );

    console.log(chalk.cyan('╔═══════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold('       RBC Codex Proxy Successfully Started       ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════════════╝\n'));

    console.log(table.toString());

    console.log(chalk.gray('\n📝 Codex Configuration (.codex/config.toml):'));
    console.log(chalk.white(`
[model_providers.rbc]
name = "RBC Internal API"
base_url = "http://localhost:${this.port}/v1"
env_key = "RBC_API_KEY"  # Set to any value

model_provider = "rbc"
model = "gpt-4.1"  # or your preferred model
    `));

    console.log(chalk.gray('\n💡 Quick Start:'));
    console.log(chalk.white(`   export RBC_API_KEY="rbc-proxy-key"`));
    console.log(chalk.white(`   codex --model-provider rbc --model gpt-4.1`));
    console.log('');
  }
}

// Start the proxy
const proxy = new RBCCodexProxy();
proxy.start().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});