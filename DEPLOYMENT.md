# Deployment Guide

## Overview

This guide covers deploying InfiniStar to production. The application is optimized for deployment on Vercel, but can be deployed to any platform that supports Next.js.

---

## Pre-Deployment Checklist

### 1. Environment Variables

Ensure all production environment variables are set:

```bash
# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Database
DATABASE_URL=<mongodb-production-url>

# OAuth
GITHUB_CLIENT_ID=<production-github-client-id>
GITHUB_CLIENT_SECRET=<production-github-client-secret>
GITHUB_ACCESS_TOKEN=<production-github-token>
GOOGLE_CLIENT_ID=<production-google-client-id>
GOOGLE_CLIENT_SECRET=<production-google-client-secret>

# Email
SMTP_FROM=noreply@yourdomain.com
POSTMARK_API_TOKEN=<production-postmark-token>
POSTMARK_SIGN_IN_TEMPLATE=<template-id>
POSTMARK_ACTIVATION_TEMPLATE=<template-id>

# Payments
STRIPE_API_KEY=<production-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<production-stripe-webhook-secret>
STRIPE_PRO_MONTHLY_PLAN_ID=<production-price-id>

# Real-time
PUSHER_APP_ID=<production-pusher-app-id>
PUSHER_SECRET=<production-pusher-secret>
NEXT_PUBLIC_PUSHER_APP_KEY=<production-pusher-key>
NEXT_PUBLIC_PUSHER_CLUSTER=<your-cluster>

# AI
ANTHROPIC_API_KEY=<production-anthropic-key>
```

### 2. Security Checklist

- [ ] Generated strong `NEXTAUTH_SECRET` using `openssl rand -base64 32`
- [ ] All environment variables use production values (not test/dev)
- [ ] OAuth callback URLs updated for production domain
- [ ] Stripe webhook endpoint configured for production
- [ ] Database has proper indexes and backup strategy
- [ ] Rate limiting configured (consider Redis for production)
- [ ] CORS settings reviewed and restricted to your domain
- [ ] Security headers configured (CSP, HSTS, etc.)

### 3. Database Preparation

```bash
# Generate Prisma Client
npx prisma generate

# Push schema to production database
npx prisma db push

# (Optional) Seed initial data
npm run seed
```

### 4. Build Verification

```bash
# Run all checks locally
npm run typecheck
npm run lint
npm test
npm run build

# Verify build succeeded
ls -la .next
```

---

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel provides the best experience for Next.js applications.

#### Initial Setup

1. **Install Vercel CLI** (optional):

   ```bash
   npm i -g vercel
   ```

2. **Push to GitHub**:

   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

3. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository
   - Configure project settings

#### Environment Variables

Add all environment variables in Vercel dashboard:

- Go to Project Settings → Environment Variables
- Add each variable from your `.env.local`
- Select appropriate environment (Production, Preview, Development)

#### Build Settings

Vercel auto-detects Next.js. Verify these settings:

```
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
Development Command: npm run dev
```

#### Custom Domain

1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Wait for SSL certificate provisioning (~5 minutes)

#### Deploy

```bash
# Manual deployment via CLI
vercel --prod

# Or push to main branch for automatic deployment
git push origin main
```

### Option 2: Docker

Deploy using Docker and Docker Compose.

#### Dockerfile

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

#### Docker Compose

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    depends_on:
      - mongodb
    restart: unless-stopped

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGODB_PASSWORD}
    restart: unless-stopped

volumes:
  mongodb_data:
```

#### Deploy

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

### Option 3: AWS (EC2 + RDS)

Deploy to AWS using EC2 for the app and RDS for MongoDB.

#### Prerequisites

- AWS account
- AWS CLI configured
- EC2 instance (t3.medium or larger recommended)
- Security groups configured (ports 22, 80, 443, 3000)

#### Steps

1. **Launch EC2 Instance**:

   ```bash
   # Connect to instance
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

2. **Install Dependencies**:

   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Node.js 20
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install PM2
   sudo npm install -g pm2

   # Install Nginx
   sudo apt install -y nginx
   ```

3. **Clone and Setup**:

   ```bash
   # Clone repo
   git clone https://github.com/yourusername/InfiniStar.git
   cd InfiniStar

   # Install dependencies
   npm ci

   # Setup environment
   cp .env.template .env.production
   nano .env.production  # Add production values

   # Build
   npm run build
   ```

4. **Start with PM2**:

   ```bash
   # Start app
   pm2 start npm --name "infinistar" -- start

   # Save PM2 configuration
   pm2 save

   # Setup PM2 to start on boot
   pm2 startup
   ```

5. **Configure Nginx**:

   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```

6. **Enable HTTPS** (with Let's Encrypt):
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

---

## Post-Deployment

### 1. Configure External Services

#### Stripe Webhooks

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
4. Copy webhook secret to environment variables

#### OAuth Callback URLs

**GitHub:**

- Homepage URL: `https://yourdomain.com`
- Authorization callback URL: `https://yourdomain.com/api/auth/callback/github`

**Google:**

- Authorized JavaScript origins: `https://yourdomain.com`
- Authorized redirect URIs: `https://yourdomain.com/api/auth/callback/google`

#### Pusher

Update allowed origins in Pusher dashboard:

- Add `https://yourdomain.com`

### 2. Monitoring Setup

#### Vercel Analytics

Automatically enabled on Vercel deployments.

#### Sentry (Error Tracking)

```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

#### Uptime Monitoring

Configure monitoring with:

- [UptimeRobot](https://uptimerobot.com)
- [Pingdom](https://www.pingdom.com)
- [Better Uptime](https://betteruptime.com)

### 3. Performance Optimization

#### CDN Configuration

For static assets, use Vercel's built-in CDN or configure Cloudflare.

#### Database Indexes

Ensure indexes are created for common queries:

```javascript
// In Prisma Studio or MongoDB shell
db.conversations.createIndex({ userIds: 1 })
db.messages.createIndex({ conversationId: 1, createdAt: -1 })
db.users.createIndex({ email: 1 })
```

#### Caching

Consider adding Redis for:

- Rate limiting (production requirement)
- Session storage
- API response caching

### 4. Backup Strategy

#### Database Backups

**MongoDB Atlas (Recommended):**

- Automatic continuous backups
- Point-in-time recovery
- Configurable retention periods

**Self-hosted MongoDB:**

```bash
# Backup script
mongodump --uri="$DATABASE_URL" --out=/backups/$(date +%Y%m%d)

# Restore
mongorestore --uri="$DATABASE_URL" /backups/20250105
```

#### Configuration Backups

- Store environment variables securely (1Password, AWS Secrets Manager)
- Keep `.env.template` updated in repository
- Document all external service configurations

---

## Troubleshooting

### Build Failures

```bash
# Clear Next.js cache
rm -rf .next

# Clear node modules
rm -rf node_modules package-lock.json
npm install

# Regenerate Prisma Client
npx prisma generate

# Try build again
npm run build
```

### Database Connection Issues

```bash
# Test MongoDB connection
node -e "const { MongoClient } = require('mongodb'); MongoClient.connect(process.env.DATABASE_URL).then(() => console.log('Connected')).catch(e => console.error(e))"

# Check Prisma connection
npx prisma db push --preview-feature
```

### Environment Variable Issues

```bash
# Verify all required variables are set
node -e "const { env } = require('./env.mjs'); console.log('✅ All environment variables valid')"
```

### Rate Limiting in Production

**Issue:** In-memory rate limiter doesn't work with multiple instances.

**Solution:** Implement Redis-based rate limiting:

```typescript
// Example with Redis
import Redis from "ioredis"

const redis = new Redis(process.env.REDIS_URL)

export async function checkRateLimit(key: string, limit: number, window: number) {
  const current = await redis.incr(key)
  if (current === 1) {
    await redis.expire(key, window)
  }
  return current <= limit
}
```

---

## Maintenance

### Regular Tasks

**Weekly:**

- [ ] Review error logs
- [ ] Check application performance
- [ ] Monitor rate limit hits

**Monthly:**

- [ ] Update dependencies: `npm update`
- [ ] Run security audit: `npm audit`
- [ ] Review and rotate API keys
- [ ] Check database backups

**Quarterly:**

- [ ] Review and optimize database queries
- [ ] Analyze and optimize bundle size
- [ ] Review and update security headers
- [ ] Performance testing

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Run migrations
npx prisma generate
npx prisma db push

# Rebuild
npm run build

# Restart (if using PM2)
pm2 restart infinistar

# Or redeploy (if using Vercel)
git push origin main
```

---

## Rollback Procedure

### Vercel

1. Go to Deployments
2. Find previous working deployment
3. Click "⋯" → "Promote to Production"

### PM2

```bash
# Stop current version
pm2 stop infinistar

# Checkout previous version
git checkout <previous-commit-hash>

# Rebuild
npm run build

# Start
pm2 start infinistar
```

### Docker

```bash
# Use previous image
docker-compose down
docker-compose up -d app:<previous-tag>
```

---

## Additional Resources

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Prisma Production Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)

---

**Last Updated:** January 2025
**Status:** Production Ready ✅
