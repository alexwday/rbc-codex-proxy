const axios = require('axios');
const fs = require('fs');
const https = require('https');
const chalk = require('chalk');

class OAuthManager {
  constructor(config) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.tokenUrl = config.tokenUrl;
    this.certPath = config.certPath;

    this.token = null;
    this.tokenExpiry = null;
    this.refreshTimer = null;
    this.refreshInterval = 15 * 60 * 1000; // 15 minutes

    // Setup axios with SSL certificate
    if (fs.existsSync(this.certPath)) {
      this.httpsAgent = new https.Agent({
        ca: fs.readFileSync(this.certPath),
        rejectUnauthorized: true
      });
      console.log(chalk.green('✅ SSL certificate loaded from:'), this.certPath);
    } else {
      this.httpsAgent = new https.Agent({ rejectUnauthorized: false });
      console.log(chalk.yellow('⚠️  SSL certificate not found, using default settings'));
    }

    this.axiosInstance = axios.create({
      httpsAgent: this.httpsAgent,
      timeout: 30000
    });
  }

  async initialize() {
    await this.fetchToken();
    this.startAutoRefresh();
  }

  async fetchToken() {
    try {
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret
      });

      console.log(chalk.gray(`Fetching OAuth token from: ${this.tokenUrl}`));

      const response = await this.axiosInstance.post(this.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      this.token = response.data.access_token;
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = Date.now() + (expiresIn * 1000);

      console.log(chalk.green(`✅ Token acquired (expires in ${expiresIn}s)`));

      return this.token;

    } catch (error) {
      console.error(chalk.red('❌ Failed to fetch OAuth token:'));

      if (error.response) {
        console.error(chalk.red(`   Status: ${error.response.status}`));
        console.error(chalk.red(`   Message: ${JSON.stringify(error.response.data)}`));
      } else if (error.request) {
        console.error(chalk.red('   No response received from OAuth server'));
        console.error(chalk.red(`   URL: ${this.tokenUrl}`));
      } else {
        console.error(chalk.red(`   Error: ${error.message}`));
      }

      // Check certificate issues
      if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
          error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
        console.error(chalk.yellow('\n⚠️  Certificate verification failed.'));
        console.error(chalk.yellow('   Please ensure rbc-ca-bundle.cer is in the certificates/ directory'));
      }

      throw error;
    }
  }

  startAutoRefresh() {
    // Clear existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    // Setup refresh timer
    this.refreshTimer = setInterval(async () => {
      console.log(chalk.blue('🔄 Auto-refreshing OAuth token...'));
      try {
        await this.fetchToken();
      } catch (error) {
        console.error(chalk.red('❌ Failed to refresh token:'), error.message);
      }
    }, this.refreshInterval);

    console.log(chalk.gray(`⏰ Token auto-refresh scheduled every ${this.refreshInterval / 60000} minutes`));
  }

  hasValidToken() {
    return this.token && Date.now() < this.tokenExpiry;
  }

  getToken() {
    if (!this.hasValidToken()) {
      console.log(chalk.yellow('⚠️  Token expired, fetching new one...'));
      return this.fetchToken();
    }
    return Promise.resolve(this.token);
  }

  getNextRefreshTime() {
    if (!this.tokenExpiry) return null;
    const remaining = Math.max(0, this.tokenExpiry - Date.now());
    return {
      seconds: Math.floor(remaining / 1000),
      time: new Date(this.tokenExpiry).toISOString()
    };
  }

  getHttpsAgent() {
    return this.httpsAgent;
  }

  destroy() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

module.exports = { OAuthManager };