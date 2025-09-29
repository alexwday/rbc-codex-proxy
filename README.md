# RBC Codex Proxy

A local OAuth proxy server that enables OpenAI Codex to work with RBC's internal API by handling OAuth authentication and SSL certificates automatically.

## Features

- 🔐 **Automatic OAuth Token Management** - Fetches and refreshes tokens every 15 minutes
- 🔒 **SSL Certificate Support** - Uses RBC's custom CA bundle for secure connections
- 📊 **Live Dashboard** - Real-time monitoring of requests and metrics
- 🚀 **OpenAI-Compatible API** - Works seamlessly with Codex CLI
- ⚡ **Streaming Support** - Full support for streaming responses
- 📈 **Request Metrics** - Track usage, response times, and success rates

## How It Works

This proxy acts as a bridge between Codex CLI and your internal OAuth-protected API:

```
[Codex CLI] → [RBC Proxy (localhost:8080)] → [Your Internal API]
                        ↓
                [OAuth Token Management]
```

1. **RBC Proxy** runs on your machine (localhost:8080)
2. **Codex CLI** connects to the proxy instead of directly to your API
3. **The proxy** handles OAuth tokens automatically and forwards requests

## Prerequisites

- Node.js 14+ and npm
- Python 3 (for installing Codex native dependencies)
- GitHub CLI (`gh`) - Required by Codex for certain operations
- Valid OAuth credentials (CLIENT_ID and CLIENT_SECRET)
- Access to your organization's OAuth token endpoint
- Access to your organization's internal API endpoint
- SSL certificate file (if required by your organization)
- OpenAI Codex CLI (installed separately)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/rbc-codex-proxy.git
cd rbc-codex-proxy
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure OAuth

Create a `.env` file based on the example:

```bash
cp .env.example .env
```

Edit `.env` and add your OAuth credentials and API endpoints:

```env
# OAuth credentials
CLIENT_ID=your-client-id-here
CLIENT_SECRET=your-client-secret-here

# Your OAuth server endpoint for getting tokens
TOKEN_URL=https://your-oauth-server.rbc.com/oauth/token

# Your internal API endpoint that accepts the OAuth tokens
API_BASE_URL=https://your-internal-api.rbc.com/v1

# Optional: Change proxy port (default: 8080)
PROXY_PORT=8080
```

### 4. Add SSL Certificate

Place your `rbc-ca-bundle.cer` file in the `certificates/` directory:

```bash
cp /path/to/rbc-ca-bundle.cer certificates/
```

### 5. Start the Proxy

```bash
npm start
```

**Expected Output (Success):**
```
🚀 Starting RBC Codex Proxy...
🔐 Fetching initial OAuth token...
✅ OAuth token acquired successfully

╔═══════════════════════════════════════════════════╗
║       RBC Codex Proxy Successfully Started       ║
╚═══════════════════════════════════════════════════╝

┌───────────────┬──────────────────────────────────┐
│ Status        │ ✅ Running                       │
│ Proxy URL     │ http://localhost:8080/v1         │
│ Dashboard     │ http://localhost:8080/dashboard  │
│ API Key       │ Use any value (e.g., "rbc-proxy")│
│ Token Refresh │ Every 15 minutes                 │
└───────────────┴──────────────────────────────────┘
```

**If OAuth fails (Missing/Invalid Credentials):**
```
🚀 Starting RBC Codex Proxy...
🔐 Fetching initial OAuth token...
❌ Failed to fetch OAuth token:
   Status: 401
   Message: {"error":"invalid_client"}
❌ Failed to start proxy: Request failed with status code 401
```

### 6. Verify the Proxy is Working

#### Check the Dashboard
1. Open http://localhost:8080/dashboard in your browser
2. You should see:
   - **Connection Status**: Should show "Connected" (not "Disconnected")
   - **OAuth Status**: Should show "✅ Token Valid" with a countdown timer
   - **Next Refresh**: Should show the time for next token refresh

**Dashboard Indicators:**
- ✅ **Working**: Connection shows "Connected", OAuth shows "Token Valid" with countdown
- ❌ **Not Working**: Connection shows "Disconnected", OAuth shows "Token Expired" or no timer

#### Test the Health Endpoint
```bash
curl http://localhost:8080/health
```

**Expected Response:**
```json
{
  "status": "running",
  "uptime": 10,
  "token_status": "valid"  // Should be "valid" not "expired"
}
```

#### Run the Test Suite
```bash
npm test
```

**Expected Output:**
```
🧪 RBC Codex Proxy Test Suite

Testing /health endpoint...
  ✅ Health endpoint is working
  Token status: valid
  Uptime: 5s

Testing /dashboard endpoint...
  ✅ Dashboard endpoint is serving HTML

Testing /api/status endpoint...
  ✅ API status endpoint is working
  Proxy port: 8080
  OAuth token: Valid

# ... more tests ...

📊 Test Results:
  Passed: 5
  Failed: 0

  Total: 5 tests (100% passed)

✅ All tests passed!
```

### 7. Install Dependencies for Codex

Before installing Codex, ensure you have the required dependencies:

#### Install GitHub CLI (Required by Codex)
```bash
# On macOS with Homebrew
brew install gh

# On macOS with MacPorts
sudo port install gh

# Or download from: https://cli.github.com/
```

#### Verify GitHub CLI is installed
```bash
gh --version
```

### 8. Install Codex CLI

Codex should be installed **separately** from the proxy, either globally or in its own directory.

**Note for Mac M1/M2 Users:** You may encounter issues with the pre-built binaries. See troubleshooting section below if you get a "spawn ENOENT" error.

#### Option 1: Install Globally from NPM (Recommended for Intel Macs/Linux)
```bash
# Install globally (from any directory)
npm install -g @openai/codex-cli

# This installs Codex system-wide, accessible from anywhere
```

#### Option 2: Install from Source in a Separate Directory
```bash
# Go to your projects directory (NOT inside rbc-codex-proxy)
cd ~/Projects  # or wherever you keep your projects

# Clone Codex into its own directory
git clone https://github.com/openai/codex.git
cd codex/codex-cli
npm install
npm link  # Makes 'codex' command available globally
```

#### Verify Installation
```bash
# From any directory, check if Codex is installed
codex --version
```

#### Troubleshooting Codex Installation on Mac (M1/M2)

If you get an error like `spawn .../aarch64-apple-darwin/codex/codex ENOENT`:

**Solution: Install from source and run the native deps script:**

```bash
# 1. Clone the repository
git clone https://github.com/openai/codex.git
cd codex/codex-cli

# 2. Install npm dependencies
npm install

# 3. Run the native dependencies installer (Python script)
python3 scripts/install_native_deps.py

# 4. Make codex available globally
npm link

# 5. Verify it works
codex --version
```

**Alternative approaches if the above doesn't work:**

1. **Try the npm package with post-install fix:**
   ```bash
   # Install globally
   npm install -g @openai/codex

   # Navigate to installation and run Python script
   cd $(npm root -g)/@openai/codex
   python3 scripts/install_native_deps.py
   ```

2. **Manual binary installation:**
   ```bash
   # In the codex/codex-cli directory
   # The Python script will download the correct binary for your platform
   python3 scripts/install_native_deps.py --verbose

   # Check if binary was downloaded
   ls -la vendor/
   ```

3. **If you see permission errors:**
   ```bash
   # You may need to use sudo for global installation
   sudo npm link
   ```

**Important:** Do NOT install Codex inside the rbc-codex-proxy folder. They are separate tools:
- **rbc-codex-proxy**: Runs locally to handle OAuth (keep running in one terminal)
- **Codex CLI**: The actual CLI tool you use to interact with AI (use in another terminal)

### 9. Configure Codex

Create or edit the Codex configuration file:

```bash
# Create config directory if it doesn't exist
mkdir -p ~/.codex

# Create or edit config file
nano ~/.codex/config.toml
```

Add the following configuration:

```toml
[model_providers.rbc]
name = "RBC Internal API"
base_url = "http://localhost:8080/v1"
env_key = "RBC_API_KEY"

# Set as default provider
model_provider = "rbc"
model = "gpt-4.1"  # or your preferred model
```

### 10. Test Codex Connection

First, set the API key environment variable:

```bash
# Set the API key (any non-empty value works)
export RBC_API_KEY="rbc-proxy-key"
```

Test the connection:

```bash
# Test with a simple prompt
echo "Hello, can you hear me?" | codex --model-provider rbc --model gpt-4.1
```

If successful, you should receive a response from the model through your proxy.

### 11. Use Codex with RBC API

Now you can use Codex normally:

```bash
# Interactive mode
codex --model-provider rbc --model gpt-4.1

# Or use with specific commands
codex --model-provider rbc --model gpt-4.1 "Explain this code: $(cat main.py)"

# Or set as default and use without flags
codex  # Will use RBC provider by default based on config
```

## Typical Setup Structure

After installation, you'll have:

```
~/Projects/                    # Your projects directory
├── rbc-codex-proxy/          # This proxy (cloned from GitHub)
│   ├── src/
│   ├── certificates/
│   │   └── rbc-ca-bundle.cer
│   ├── .env                  # Your OAuth credentials
│   └── package.json
│
└── [Codex installed globally via npm]

~/.codex/                     # Codex configuration directory
└── config.toml              # Points to localhost:8080
```

## Typical Workflow

1. **Terminal 1 - Start the proxy:**
   ```bash
   cd ~/Projects/rbc-codex-proxy
   npm start
   # Leave this running
   ```

2. **Terminal 2 - Use Codex normally:**
   ```bash
   cd ~/YourWorkProject
   export RBC_API_KEY="rbc-proxy-key"
   codex --model-provider rbc --model gpt-4.1
   ```

## Verification Checklist

After setup, verify everything is working:

- [ ] **Proxy starts without errors** - See "OAuth token acquired successfully"
- [ ] **Dashboard accessible** - http://localhost:8080/dashboard loads
- [ ] **Dashboard shows "Connected"** - Not "Disconnected"
- [ ] **OAuth token valid** - Dashboard shows "✅ Token Valid" with countdown
- [ ] **Health check passes** - `curl http://localhost:8080/health` returns `"token_status": "valid"`
- [ ] **Test suite passes** - `npm test` shows all tests passing
- [ ] **Codex installed** - `codex --version` shows version number
- [ ] **Codex configured** - `~/.codex/config.toml` contains RBC provider settings
- [ ] **Codex can connect** - Test prompt receives a response

## Dashboard

Access the live dashboard at: http://localhost:8080/dashboard

The dashboard shows:
- Real-time request statistics
- OAuth token status and countdown
- Model usage breakdown
- Recent request history
- Average response times
- Success/error rates

**Working Dashboard Example:**
- Connection: Connected ✅
- OAuth Status: Token Valid ✅
- Countdown Timer: 14:32 (showing time until refresh)
- Next Refresh: Shows specific time

**Not Working Dashboard Example:**
- Connection: Disconnected ❌
- OAuth Status: Token Expired ❌
- Countdown Timer: -- (no timer shown)
- Next Refresh: --:--:--

## Testing

Run the test suite to verify the proxy is working:

```bash
npm test
```

Tests include:
- Health endpoint verification
- Dashboard accessibility
- API authentication
- Error handling

## Project Structure

```
rbc-codex-proxy/
├── src/
│   ├── index.js            # Main proxy server
│   ├── oauth-manager.js    # OAuth token management
│   ├── proxy-handler.js    # Request forwarding logic
│   ├── metrics.js          # Metrics collection
│   └── dashboard-server.js # WebSocket server for dashboard
├── public/
│   └── dashboard.html      # Dashboard UI
├── test/
│   └── test-proxy.js       # Test suite
├── certificates/
│   └── .gitkeep           # Place rbc-ca-bundle.cer here
├── .env.example           # Environment configuration template
├── .gitignore            # Git ignore rules
├── package.json          # Node.js dependencies
└── README.md            # This file
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLIENT_ID` | OAuth client ID | Required |
| `CLIENT_SECRET` | OAuth client secret | Required |
| `TOKEN_URL` | OAuth token endpoint (your OAuth server) | Required |
| `API_BASE_URL` | Internal API base URL (where tokens are used) | Required |
| `PROXY_PORT` | Local proxy port | `8080` |

### Supported Models

The proxy supports any model available through your RBC API access. Common models:

- `gpt-4.1`
- `gpt-3.5-turbo`
- `gpt-4-turbo`

Configure the model in your Codex config or specify at runtime:

```bash
codex --model gpt-4.1
```

## Troubleshooting

### Dashboard Shows "Disconnected"

This usually means the WebSocket connection between the dashboard and server failed:

1. **Refresh the browser page** - Sometimes the initial connection fails
2. **Check if proxy is still running** - Look at the terminal where you ran `npm start`
3. **Try a different browser** - Some browsers block local WebSocket connections
4. **Check browser console** - Press F12 and look for WebSocket errors

### No OAuth Token in Dashboard

If the dashboard shows "Token Expired" or no countdown timer:

1. **Check proxy startup logs** - Did you see "✅ OAuth token acquired successfully"?
2. **Verify credentials** - Your `CLIENT_ID` and `CLIENT_SECRET` must be valid
3. **Test OAuth endpoint** - Try manually:
   ```bash
   curl -X POST YOUR_TOKEN_URL \
     -d "grant_type=client_credentials" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET"
   ```
4. **Check SSL certificate** - OAuth server may require the certificate

### Certificate Issues

If you see SSL certificate errors:

1. Ensure `rbc-ca-bundle.cer` is in the `certificates/` directory
2. Check the certificate is valid and not expired:
   ```bash
   openssl x509 -in certificates/rbc-ca-bundle.cer -text -noout
   ```
3. Verify the certificate matches your API endpoint
4. Try disabling certificate validation temporarily (for testing only):
   ```javascript
   // In src/oauth-manager.js, change rejectUnauthorized
   this.httpsAgent = new https.Agent({ rejectUnauthorized: false });
   ```

### OAuth Token Errors

If token fetching fails:

1. Verify your `CLIENT_ID` and `CLIENT_SECRET` are correct
2. Check the `TOKEN_URL` matches your OAuth server
3. Ensure your credentials have the necessary permissions
4. Check network connectivity to the OAuth server:
   ```bash
   ping your-oauth-server.rbc.com
   nslookup your-oauth-server.rbc.com
   ```

### Proxy Starts But Can't Fetch Token

If you see "Failed to start proxy" after "Fetching initial OAuth token":

1. **Missing environment variables** - All 4 are required:
   - CLIENT_ID
   - CLIENT_SECRET
   - TOKEN_URL
   - API_BASE_URL
2. **Invalid OAuth endpoint** - Verify the TOKEN_URL is correct
3. **Network/Firewall issues** - Can you reach the OAuth server?
4. **Certificate required** - Some OAuth servers require the SSL certificate

### Connection Refused

If Codex can't connect to the proxy:

1. Ensure the proxy is running (`npm start`)
2. Check the port isn't already in use:
   ```bash
   lsof -i :8080
   ```
3. Verify the `base_url` in your Codex config matches the proxy URL
4. Try connecting directly:
   ```bash
   curl http://localhost:8080/health
   ```

### No Response from API

If requests timeout or fail:

1. Check the `API_BASE_URL` in your `.env` file
2. Verify your OAuth token has API access permissions
3. Check the dashboard for error details
4. Review proxy logs in the terminal
5. Test the API directly with your token:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" YOUR_API_BASE_URL/test
   ```

## Security

- OAuth tokens are stored only in memory
- Tokens are automatically refreshed before expiration
- SSL certificates ensure secure communication
- The `.env` file should never be committed to git
- The proxy only accepts local connections by default

## Development

### Running in Development Mode

```bash
npm run dev
```

This uses `nodemon` to automatically restart on file changes.

### Adding New Endpoints

To support additional API endpoints, edit `src/proxy-handler.js` and add new route handlers in `src/index.js`.

## Support

For issues or questions:

1. Check the dashboard for real-time status
2. Review the terminal logs for detailed error messages
3. Run the test suite to verify basic functionality
4. Contact your team's DevOps or API support

## License

Internal use only - RBC proprietary

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Note**: This proxy is designed specifically for RBC's internal API and OAuth system. It will not work with standard OpenAI endpoints.