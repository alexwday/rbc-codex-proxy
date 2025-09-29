const axios = require('axios');
const chalk = require('chalk');

class ProxyHandler {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.oauthManager = config.oauthManager;
    this.metrics = config.metrics;

    // Create axios instance with SSL support
    this.axiosInstance = axios.create({
      httpsAgent: this.oauthManager.getHttpsAgent(),
      timeout: 120000, // 2 minutes for model responses
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    // Setup response interceptor for streaming
    this.setupInterceptors();
  }

  setupInterceptors() {
    this.axiosInstance.interceptors.response.use(
      response => response,
      error => {
        // Log detailed errors
        if (error.response) {
          console.error(chalk.red(`API Error: ${error.response.status} - ${error.response.statusText}`));
          if (error.response.data) {
            console.error(chalk.red('Response:', JSON.stringify(error.response.data, null, 2)));
          }
        } else if (error.request) {
          console.error(chalk.red('No response received from API'));
        } else {
          console.error(chalk.red('Request error:', error.message));
        }
        return Promise.reject(error);
      }
    );
  }

  async handleChatCompletion(req, res) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      // Validate API key (accept any non-empty value)
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: {
            message: 'Missing or invalid authorization header. Use any non-empty API key.',
            type: 'invalid_request_error'
          }
        });
      }

      // Get fresh OAuth token
      const token = await this.oauthManager.getToken();

      // Apply default parameters from environment (can be overridden by request)
      const requestBody = {
        ...req.body,
        max_tokens: req.body.max_tokens || parseInt(process.env.MAX_TOKENS || '4096'),
        temperature: req.body.temperature !== undefined ? req.body.temperature : parseFloat(process.env.TEMPERATURE || '0.7'),
        top_p: req.body.top_p !== undefined ? req.body.top_p : parseFloat(process.env.TOP_P || '1.0'),
        frequency_penalty: req.body.frequency_penalty !== undefined ? req.body.frequency_penalty : parseFloat(process.env.FREQUENCY_PENALTY || '0'),
        presence_penalty: req.body.presence_penalty !== undefined ? req.body.presence_penalty : parseFloat(process.env.PRESENCE_PENALTY || '0')
      };

      // Log request
      console.log(chalk.cyan(`[${requestId}] Chat Completion Request`));
      console.log(chalk.gray(`  Model: ${requestBody.model}`));
      console.log(chalk.gray(`  Max Tokens: ${requestBody.max_tokens}`));
      console.log(chalk.gray(`  Temperature: ${requestBody.temperature}`));
      console.log(chalk.gray(`  Stream: ${requestBody.stream || false}`));
      console.log(chalk.gray(`  Messages: ${requestBody.messages?.length || 0}`));

      // Record metrics
      this.metrics.recordRequest({
        id: requestId,
        model: requestBody.model,
        endpoint: '/v1/chat/completions',
        timestamp: new Date().toISOString()
      });

      // Forward request to actual API
      const apiUrl = `${this.baseUrl}/chat/completions`;

      if (requestBody.stream) {
        // Handle streaming response
        await this.handleStreamingResponse(requestBody, res, apiUrl, token, requestId);
      } else {
        // Handle regular response
        await this.handleRegularResponse(requestBody, res, apiUrl, token, requestId);
      }

      // Record success
      const duration = Date.now() - startTime;
      this.metrics.recordResponse({
        id: requestId,
        duration,
        status: 'success'
      });

      console.log(chalk.green(`[${requestId}] Completed in ${duration}ms`));

    } catch (error) {
      // Record error
      this.metrics.recordResponse({
        id: requestId,
        duration: Date.now() - startTime,
        status: 'error',
        error: error.message
      });

      // Send error response
      if (!res.headersSent) {
        const errorResponse = this.formatErrorResponse(error);
        res.status(errorResponse.status).json(errorResponse.body);
      }

      console.error(chalk.red(`[${requestId}] Error:`, error.message));
    }
  }

  async handleRegularResponse(requestBody, res, apiUrl, token, requestId) {
    const response = await this.axiosInstance.post(apiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // Add proxy metadata
    const responseData = response.data;
    if (responseData && !responseData._proxy) {
      responseData._proxy = {
        served_by: 'rbc-codex-proxy',
        request_id: requestId
      };
    }

    res.status(response.status).json(responseData);
  }

  async handleStreamingResponse(requestBody, res, apiUrl, token, requestId) {
    const response = await this.axiosInstance.post(apiUrl, requestBody, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      responseType: 'stream'
    });

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Request-Id': requestId
    });

    // Pipe the stream
    response.data.on('data', chunk => {
      res.write(chunk);
    });

    response.data.on('end', () => {
      res.end();
    });

    response.data.on('error', error => {
      console.error(chalk.red(`[${requestId}] Stream error:`, error.message));
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
  }

  async handleCompletion(req, res) {
    // Similar to handleChatCompletion but for /v1/completions endpoint
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const token = await this.oauthManager.getToken();

      // Apply default parameters from environment (can be overridden by request)
      const requestBody = {
        ...req.body,
        max_tokens: req.body.max_tokens || parseInt(process.env.MAX_TOKENS || '4096'),
        temperature: req.body.temperature !== undefined ? req.body.temperature : parseFloat(process.env.TEMPERATURE || '0.7'),
        top_p: req.body.top_p !== undefined ? req.body.top_p : parseFloat(process.env.TOP_P || '1.0'),
        frequency_penalty: req.body.frequency_penalty !== undefined ? req.body.frequency_penalty : parseFloat(process.env.FREQUENCY_PENALTY || '0'),
        presence_penalty: req.body.presence_penalty !== undefined ? req.body.presence_penalty : parseFloat(process.env.PRESENCE_PENALTY || '0')
      };

      console.log(chalk.cyan(`[${requestId}] Completion Request`));
      console.log(chalk.gray(`  Model: ${requestBody.model}`));
      console.log(chalk.gray(`  Max Tokens: ${requestBody.max_tokens}`));

      this.metrics.recordRequest({
        id: requestId,
        model: requestBody.model,
        endpoint: '/v1/completions',
        timestamp: new Date().toISOString()
      });

      const apiUrl = `${this.baseUrl}/completions`;

      const response = await this.axiosInstance.post(apiUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      res.status(response.status).json(response.data);

      this.metrics.recordResponse({
        id: requestId,
        duration: Date.now() - startTime,
        status: 'success'
      });

    } catch (error) {
      this.metrics.recordResponse({
        id: requestId,
        duration: Date.now() - startTime,
        status: 'error',
        error: error.message
      });

      if (!res.headersSent) {
        const errorResponse = this.formatErrorResponse(error);
        res.status(errorResponse.status).json(errorResponse.body);
      }
    }
  }

  formatErrorResponse(error) {
    if (error.response) {
      // API returned an error
      return {
        status: error.response.status,
        body: error.response.data || {
          error: {
            message: `API error: ${error.response.statusText}`,
            type: 'api_error',
            code: error.response.status
          }
        }
      };
    } else {
      // Network or other error
      return {
        status: 500,
        body: {
          error: {
            message: error.message || 'Internal proxy error',
            type: 'proxy_error'
          }
        }
      };
    }
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = { ProxyHandler };