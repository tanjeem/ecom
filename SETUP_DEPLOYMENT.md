# Setup & Deployment Guide

## Local Development Setup

### Prerequisites
- **Node.js**: v18 or later (LTS recommended)
- **npm**: v9 or later
- **Git**: For version control
- **Text Editor**: VS Code recommended with TypeScript support

### Step 1: Clone & Install

```bash
# Clone the repository (if not already done)
cd ~/Desktop/SP/ecom

# Install dependencies
npm install
```

### Step 2: Environment Configuration

```bash
# Copy example env file
cp .env.example .env.local

# Edit .env.local with your actual credentials
# You'll need:
# 1. WooCommerce store credentials
# 2. Pathao API credentials
nano .env.local
```

### Step 3: Verify Setup

```bash
# Type check the project
npm run typecheck

# Check for lint errors
npm run lint
```

### Step 4: Start Development Server

```bash
# Start Next.js dev server
npm run dev

# Open in browser
# http://localhost:3000
```

### Step 5: Test Integrations

1. **Check Status Endpoint**
   ```bash
   curl http://localhost:3000/api/config/status
   # Should return: { woocommerce: true/false, pathao: true/false }
   ```

2. **Test WooCommerce Sync**
   - Click "Dashboard" in sidebar
   - Go to "Orders" section
   - Click "Sync Woo Orders"
   - Check browser console for errors

3. **Test Pathao Configuration**
   - Should show in status endpoint if credentials are valid
   - Test with one order before bulk operations

---

## Environment Variables Reference

### WooCommerce Configuration

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `WOOCOMMERCE_URL` | Yes | `https://mystore.com` | No trailing slash |
| `WOOCOMMERCE_CONSUMER_KEY` | Yes | `ck_1234567890...` | Generate in WP Admin: WooCommerce → Settings → Advanced → REST API |
| `WOOCOMMERCE_CONSUMER_SECRET` | Yes | `cs_0987654321...` | Generated with consumer key |

**How to Generate WooCommerce Credentials:**
1. Log in to WooCommerce admin
2. Navigate to WooCommerce → Settings → Advanced → REST API
3. Create new key with:
   - Description: "ThreadOps Commerce"
   - User: Select admin user
   - Permissions: Read/Write
4. Copy Consumer Key and Secret to `.env.local`

### Pathao Configuration

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `PATHAO_CLIENT_ID` | Yes | `your_client_id` | From Pathao dashboard |
| `PATHAO_CLIENT_SECRET` | Yes | `your_client_secret` | From Pathao dashboard |
| `PATHAO_USERNAME` | No | `your_username` | Only if using password grant |
| `PATHAO_PASSWORD` | No | `your_password` | Only if using password grant |
| `PATHAO_STORE_ID` | Yes | `123` | Your store ID in Pathao |
| `PATHAO_SENDER_NAME` | Yes | `My Store` | Default sender name |
| `PATHAO_SENDER_PHONE` | Yes | `01700000000` | 11-digit BD phone |
| `PATHAO_CITY_ID` | Yes | `1` | 1=Dhaka, 2=Chattogram, etc. |
| `PATHAO_ZONE_ID` | Yes | `1` | Zone within city |
| `PATHAO_AREA_ID` | Yes | `1` | Specific area/thana |
| `PATHAO_BASE_URL` | No | `https://api-hermes.pathao.com` | Default is correct |

**How to Get Pathao Credentials:**
1. Log in to Pathao Business dashboard
2. Go to Settings → API → Applications
3. Create new app or use existing
4. Copy Client ID and Secret
5. Note your store ID from dashboard
6. Get Zone/Area IDs from delivery locations settings

---

## Build & Production

### Production Build

```bash
# Create optimized production build
npm run build

# This runs:
# 1. TypeScript compilation
# 2. Next.js build optimization
# 3. Output in .next/ folder
```

### Run Production Server

```bash
# Start production server
npm start

# Server runs on http://localhost:3000 (default)
# Set PORT env var to use different port:
PORT=8080 npm start
```

### Environment for Production

```bash
# .env.local must contain all required variables
# In production, set these via your hosting platform:
# - Vercel: Project Settings → Environment Variables
# - Docker: Dockerfile ENV or docker run -e
# - Traditional server: ~/.bashrc or systemd service

# NEVER commit .env.local to git
# .gitignore already includes it
```

---

## Docker Setup (Optional)

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start app
CMD ["npm", "start"]
```

### Build & Run with Docker

```bash
# Build image
docker build -t threadops-commerce .

# Run container
docker run -p 3000:3000 \
  -e WOOCOMMERCE_URL="https://store.com" \
  -e WOOCOMMERCE_CONSUMER_KEY="ck_..." \
  -e WOOCOMMERCE_CONSUMER_SECRET="cs_..." \
  -e PATHAO_CLIENT_ID="..." \
  -e PATHAO_CLIENT_SECRET="..." \
  threadops-commerce
```

---

## Deployment Options

### Option 1: Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (first time)
vercel

# Deploy (subsequent)
vercel --prod

# Set environment variables in Vercel dashboard:
# Project Settings → Environment Variables
```

**Vercel Deployment Checklist:**
- [ ] Create Vercel account
- [ ] Connect GitHub repository
- [ ] Add environment variables in project settings
- [ ] Deploy branch (usually `main`)
- [ ] Test production URL
- [ ] Set up auto-deploy on git push

### Option 2: Traditional VPS (DigitalOcean, Linode, AWS EC2)

```bash
# On your VPS:

# 1. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Clone repository
git clone <repo-url> /var/www/threadops
cd /var/www/threadops

# 3. Install dependencies
npm ci --production

# 4. Create .env file
sudo nano .env.local
# Add all required environment variables

# 5. Build
npm run build

# 6. Setup systemd service
sudo nano /etc/systemd/system/threadops.service
```

**systemd Service File:**
```ini
[Unit]
Description=ThreadOps Commerce OS
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/threadops
Environment="NODE_ENV=production"
EnvironmentFile=/var/www/threadops/.env.local
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable threadops
sudo systemctl start threadops

# Check status
sudo systemctl status threadops
```

### Option 3: Railway, Render, or Heroku

These platforms have free tiers and easy Next.js deployment:

**Railway:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway link
railway up
```

**Render:**
1. Connect GitHub repository
2. Select "Next.js" as service type
3. Add environment variables
4. Deploy automatically

---

## Monitoring & Logging

### Development Logging

```bash
# View Real-time Logs
npm run dev

# Logs appear in terminal
# Look for errors in API routes and console output
```

### Production Logging

### Using PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Create ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'threadops',
    script: 'npm start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js

# View logs
pm2 logs threadops

# Monitor
pm2 monit
```

### Health Check Endpoint

The `/api/config/status` endpoint can be used for health monitoring:

```bash
# Health check script
curl -f http://localhost:3000/api/config/status || (
  echo "Health check failed"
  systemctl restart threadops
)
```

---

## Troubleshooting

### 1. Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process (macOS/Linux)
kill -9 <PID>

# Use different port
PORT=3001 npm run dev
```

### 2. Environment Variables Not Loading

```bash
# Check if .env.local exists
ls -la .env.local

# Verify format (no spaces around =)
cat .env.local

# Check if variables are actually set
node -e "console.log(process.env.WOOCOMMERCE_URL)"
```

### 3. WooCommerce Connection Error

```bash
# Test credentials with curl
curl -u "key:secret" \
  "https://store.com/wp-json/wc/v3/orders?limit=1"

# Should return 200 with orders
# If 401: credentials wrong
# If 404: URL wrong
```

### 4. Pathao Connection Error

```bash
# Test token generation
curl -X POST https://api-hermes.pathao.com/aladdin/api/v1/issue-token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id":"YOUR_ID",
    "client_secret":"YOUR_SECRET",
    "grant_type":"client_credentials"
  }'

# Should return access_token
# If error: credentials or grant type wrong
```

### 5. TypeScript Errors

```bash
# Type check project
npm run typecheck

# This will show all type errors
# Fix errors before committing
```

### 6. Build Fails

```bash
# Clean build cache
rm -rf .next

# Rebuild
npm run build

# Check for errors in output
```

---

## Performance Optimization

### Caching Headers

Already configured in Next.js, but verify:
```typescript
// next.config.mjs
module.exports = {
  // ... other config
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-store' }
      ]
    }
  ]
};
```

### Database Optimization

Currently using in-memory mock data. For production:
- Implement Redis for API response caching
- Add database for persistent state
- Implement request deduplication

### API Rate Limiting

Add middleware to prevent abuse:

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  // Implement rate limiting
  // Check IP address against request count
  // Return 429 if exceeded
}

export const config = {
  matcher: '/api/:path*'
};
```

---

## Security Checklist

- [ ] All credentials in `.env.local` (never in code)
- [ ] `.env.local` in `.gitignore`
- [ ] Use HTTPS in production (enforce with `next.config.js`)
- [ ] Set secure headers (CSP, X-Frame-Options, etc.)
- [ ] Implement rate limiting on API routes
- [ ] Validate all user inputs
- [ ] Use environment-specific configs
- [ ] Regular dependency updates: `npm audit fix`
- [ ] Enable CORS only for trusted domains
- [ ] Log and monitor unauthorized access attempts

---

## Backup & Recovery

### Regular Backups

```bash
# Backup code and config
tar -czf threadops-backup-$(date +%Y%m%d).tar.gz \
  app/ lib/ components/ package.json package-lock.json

# Backup environment (don't share!)
cp .env.local .env.local.backup
```

### Database Backup (When Implemented)

```bash
# Add to crontab for daily backups
0 2 * * * pg_dump threadops_db | gzip > /backups/threadops-$(date +\%Y\%m\%d).sql.gz
```

---

## Update & Maintenance

### Regular Updates

```bash
# Check for outdated packages
npm outdated

# Update minor/patch versions (safe)
npm update

# Update to latest major (review breaking changes)
npm install next@latest react@latest

# Type check after updates
npm run typecheck
```

### Dependency Security

```bash
# Audit for vulnerabilities
npm audit

# Fix automatically if possible
npm audit fix

# For high severity issues
npm audit fix --audit-level=moderate
```

---

## Support & Resources

- **Next.js Docs**: https://nextjs.org/docs
- **WooCommerce API**: https://woocommerce.com/document/woocommerce-rest-api/
- **Pathao API**: Contact Pathao support
- **Node.js**: https://nodejs.org/docs/

