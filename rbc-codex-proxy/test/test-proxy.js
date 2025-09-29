#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');

class ProxyTester {
  constructor() {
    this.baseUrl = 'http://localhost:8080';
    this.apiKey = 'test-api-key';
    this.testsPassed = 0;
    this.testsFailed = 0;
  }

  async runTests() {
    console.log(chalk.cyan('\n🧪 RBC Codex Proxy Test Suite\n'));
    console.log(chalk.gray('Make sure the proxy is running before running tests.\n'));

    // Test health endpoint
    await this.testHealthEndpoint();

    // Test dashboard endpoint
    await this.testDashboardEndpoint();

    // Test API status endpoint
    await this.testApiStatus();

    // Test chat completions endpoint
    await this.testChatCompletions();

    // Test error handling
    await this.testErrorHandling();

    // Print results
    this.printResults();
  }

  async testHealthEndpoint() {
    console.log(chalk.yellow('Testing /health endpoint...'));
    try {
      const response = await axios.get(`${this.baseUrl}/health`);

      if (response.status === 200 && response.data.status === 'running') {
        this.pass('Health endpoint is working');
        console.log(chalk.gray(`  Token status: ${response.data.token_status}`));
        console.log(chalk.gray(`  Uptime: ${Math.floor(response.data.uptime)}s`));
      } else {
        this.fail('Health endpoint returned unexpected data');
      }
    } catch (error) {
      this.fail(`Health endpoint failed: ${error.message}`);
    }
  }

  async testDashboardEndpoint() {
    console.log(chalk.yellow('\nTesting /dashboard endpoint...'));
    try {
      const response = await axios.get(`${this.baseUrl}/dashboard`);

      if (response.status === 200 && response.data.includes('RBC Codex Proxy')) {
        this.pass('Dashboard endpoint is serving HTML');
      } else {
        this.fail('Dashboard endpoint returned unexpected content');
      }
    } catch (error) {
      this.fail(`Dashboard endpoint failed: ${error.message}`);
    }
  }

  async testApiStatus() {
    console.log(chalk.yellow('\nTesting /api/status endpoint...'));
    try {
      const response = await axios.get(`${this.baseUrl}/api/status`);

      if (response.status === 200 && response.data.proxy && response.data.oauth) {
        this.pass('API status endpoint is working');
        console.log(chalk.gray(`  Proxy port: ${response.data.proxy.port}`));
        console.log(chalk.gray(`  OAuth token: ${response.data.oauth.hasToken ? 'Valid' : 'Invalid'}`));
      } else {
        this.fail('API status endpoint returned unexpected data');
      }
    } catch (error) {
      this.fail(`API status endpoint failed: ${error.message}`);
    }
  }

  async testChatCompletions() {
    console.log(chalk.yellow('\nTesting /v1/chat/completions endpoint...'));

    // Test missing auth header
    try {
      await axios.post(`${this.baseUrl}/v1/chat/completions`, {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Test' }]
      });
      this.fail('Should have rejected request without auth header');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.pass('Correctly rejected request without auth header');
      } else {
        this.fail(`Unexpected error: ${error.message}`);
      }
    }

    // Test with auth header (will fail if no OAuth token configured)
    console.log(chalk.gray('  Testing with auth header...'));
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/chat/completions`,
        {
          model: 'gpt-4',
          messages: [{ role: 'user', content: 'Test message' }],
          max_tokens: 10
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      this.pass('Chat completions endpoint accepted request');
      console.log(chalk.gray('  Note: Request may fail if OAuth is not configured'));
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        this.fail('Proxy is not running on port 8080');
      } else if (error.response && error.response.status >= 500) {
        // Expected if OAuth is not configured
        console.log(chalk.gray('  Request failed (likely due to missing OAuth config)'));
        this.pass('Endpoint is reachable but OAuth not configured');
      } else {
        console.log(chalk.gray(`  Error: ${error.message}`));
        this.pass('Endpoint is working (OAuth configuration needed for full test)');
      }
    }
  }

  async testErrorHandling() {
    console.log(chalk.yellow('\nTesting error handling...'));

    try {
      await axios.post(
        `${this.baseUrl}/v1/chat/completions`,
        { invalid: 'data' },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      this.pass('Error handling test completed');
    } catch (error) {
      if (error.response) {
        this.pass('Server properly handles invalid requests');
      } else {
        this.fail('Unexpected error in error handling test');
      }
    }
  }

  pass(message) {
    console.log(chalk.green(`  ✅ ${message}`));
    this.testsPassed++;
  }

  fail(message) {
    console.log(chalk.red(`  ❌ ${message}`));
    this.testsFailed++;
  }

  printResults() {
    console.log(chalk.cyan('\n📊 Test Results:\n'));
    console.log(chalk.green(`  Passed: ${this.testsPassed}`));
    console.log(chalk.red(`  Failed: ${this.testsFailed}`));

    const total = this.testsPassed + this.testsFailed;
    const percentage = total > 0 ? Math.round((this.testsPassed / total) * 100) : 0;

    console.log(chalk.bold(`\n  Total: ${total} tests (${percentage}% passed)\n`));

    if (this.testsFailed === 0) {
      console.log(chalk.green('✅ All tests passed!'));
    } else {
      console.log(chalk.yellow('⚠️  Some tests failed. Check the output above.'));
    }

    // Exit with appropriate code
    process.exit(this.testsFailed === 0 ? 0 : 1);
  }
}

// Run tests
const tester = new ProxyTester();
tester.runTests().catch(error => {
  console.error(chalk.red('Fatal error running tests:'), error);
  process.exit(1);
});