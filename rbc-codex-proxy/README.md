# RBC Codex Proxy

A local OAuth proxy server that enables OpenAI Codex to work with RBC's internal API by handling OAuth authentication and SSL certificates automatically.

## Features

- 🔐 **Automatic OAuth Token Management** - Fetches and refreshes tokens every 15 minutes
- 🔒 **SSL Certificate Support** - Uses RBC's custom CA bundle for secure connections
- 📊 **Live Dashboard** - Real-time monitoring of requests and metrics
- 🚀 **OpenAI-Compatible API** - Works seamlessly with Codex CLI
- ⚡ **Streaming Support** - Full support for streaming responses
- 📈 **Request Metrics** - Track usage, response times, and success rates

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

Edit `.env` and add your OAuth credentials:

```env
CLIENT_ID=your-client-id-here
CLIENT_SECRET=your-client-secret-here

# Optional: Override defaults
TOKEN_URL=https://api.rbc.com/oauth/token
API_BASE_URL=https://api.rbc.com/v1
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

You should see:

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

### 6. Configure Codex

Add the following to your `~/.codex/config.toml`:

```toml
[model_providers.rbc]
name = "RBC Internal API"
base_url = "http://localhost:8080/v1"
env_key = "RBC_API_KEY"

# Set as default provider
model_provider = "rbc"
model = "gpt-4.1"  # or your preferred model
```

### 7. Use Codex with RBC API

```bash
# Set the API key (any non-empty value works)
export RBC_API_KEY="rbc-proxy-key"

# Run Codex
codex --model-provider rbc --model gpt-4.1
```

## Dashboard

Access the live dashboard at: http://localhost:8080/dashboard

The dashboard shows:
- Real-time request statistics
- OAuth token status and countdown
- Model usage breakdown
- Recent request history
- Average response times
- Success/error rates

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
| `TOKEN_URL` | OAuth token endpoint | `https://api.rbc.com/oauth/token` |
| `API_BASE_URL` | RBC API base URL | `https://api.rbc.com/v1` |
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

### Certificate Issues

If you see SSL certificate errors:

1. Ensure `rbc-ca-bundle.cer` is in the `certificates/` directory
2. Check the certificate is valid and not expired
3. Verify the certificate matches your API endpoint

### OAuth Token Errors

If token fetching fails:

1. Verify your `CLIENT_ID` and `CLIENT_SECRET` are correct
2. Check the `TOKEN_URL` matches your OAuth server
3. Ensure your credentials have the necessary permissions
4. Check network connectivity to the OAuth server

### Connection Refused

If Codex can't connect to the proxy:

1. Ensure the proxy is running (`npm start`)
2. Check the port isn't already in use
3. Verify the `base_url` in your Codex config matches the proxy URL

### No Response from API

If requests timeout or fail:

1. Check the `API_BASE_URL` in your `.env` file
2. Verify your OAuth token has API access permissions
3. Check the dashboard for error details
4. Review proxy logs in the terminal

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