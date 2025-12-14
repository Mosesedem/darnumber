# Complete Setup Guide - DarNumber SMS Verification Service

## Quick Start (Development)

### 1. Prerequisites

```bash
# Check Node.js version (18+ required)
node --version

# Check PostgreSQL
psql --version

# Check Redis
redis-cli --version

# Install pnpm if not installed
npm install -g pnpm
```

### 2. Clone and Install

```bash
git clone <repository-url>
cd darnumber
pnpm install
cd backend && pnpm install && cd ..
```

### 3. Database Setup

```bash
# Create PostgreSQL database
createdb darnumber

# Or using psql
psql -U postgres
CREATE DATABASE darnumber;
\q

# Generate Prisma Client and run migrations
cd backend
pnpm prisma generate
pnpm prisma migrate dev
```

### 4. Environment Configuration

#### Frontend `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

#### Backend `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/darnumber
DATABASE_READ_REPLICA_URL=postgresql://postgres:password@localhost:5432/darnumber

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secrets (generate strong random strings)
JWT_SECRET=your-256-bit-secret-here
JWT_REFRESH_SECRET=your-refresh-256-bit-secret-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# SMS Providers (get from providers)
SMSMAN_API_KEY=your-smsman-api-key
TEXTVERIFIED_API_KEY=your-textverified-api-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=NGN

# AWS (for SES email and CloudWatch)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
AWS_CLOUDWATCH_LOG_GROUP=/darnumber/production

# Email (AWS SES SMTP)
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=noreply@yourdomain.com

# Application
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:3000
```

### 5. Start Services

#### Terminal 1 - Redis:

```bash
redis-server
```

#### Terminal 2 - Backend:

```bash
cd backend
pnpm dev
```

#### Terminal 3 - Frontend:

```bash
pnpm dev
```

### 6. Access Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api
- Health Check: http://localhost:3001/api/health

### 7. Create Admin User

```bash
# Connect to database
psql -U postgres darnumber

# Update a user to admin
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
```

## Production Deployment

### Manual Deployment

#### Backend (AWS EC2 / Render / Railway)

```bash
# 1. Build backend
cd backend
pnpm install
pnpm build

# 2. Set environment variables on server
# Use your hosting provider's dashboard

# 3. Run migrations
pnpm prisma migrate deploy

# 4. Start with PM2
pm2 start dist/index.js --name darnumber-api

# 5. Setup PM2 to restart on reboot
pm2 startup
pm2 save
```

#### Frontend (Vercel / Netlify / AWS Amplify)

```bash
# 1. Connect repository to hosting provider
# 2. Set build command: pnpm build
# 3. Set output directory: .next
# 4. Add environment variables in dashboard:
#    - NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
#    - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Database Migrations

```bash
# Development
pnpm prisma migrate dev

# Production
pnpm prisma migrate deploy

# Reset database (DEV ONLY)
pnpm prisma migrate reset
```

## API Provider Setup

### SMS-Man

1. Sign up at https://sms-man.com
2. Navigate to API section
3. Copy API key
4. Add to `backend/.env` as `SMSMAN_API_KEY`
5. Fund account with minimum $10

### TextVerified

1. Sign up at https://www.textverified.com
2. Go to API section
3. Generate API key
4. Add to `backend/.env` as `TEXTVERIFIED_API_KEY`
5. Add initial credits

### Stripe

1. Create account at https://stripe.com
2. Get API keys from Dashboard > Developers > API keys
3. Test keys (pk*test*... and sk*test*...) for development
4. Live keys (pk*live*... and sk*live*...) for production
5. Set up webhook endpoint:
   - URL: `https://api.yourdomain.com/api/payments/webhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
6. Copy webhook secret to `STRIPE_WEBHOOK_SECRET`

### AWS Services

#### SES (Email)

```bash
# 1. Verify domain or email in SES
# 2. Request production access (remove sandbox)
# 3. Create SMTP credentials
# 4. Add credentials to backend/.env
```

#### CloudWatch (Logs)

```bash
# 1. Create IAM user with CloudWatch Logs permissions
# 2. Generate access key
# 3. Add to backend/.env
```

## Monitoring Setup

### Health Checks

```bash
# API health
curl http://localhost:3001/api/health

# Response:
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected"
}
```

### Logs

```bash
# View backend logs
tail -f backend/logs/combined.log

# View error logs
tail -f backend/logs/error.log

# Process manager logs (e.g., PM2)
pm2 logs
```

### Metrics Dashboard

- Access admin dashboard at `/admin`
- View:
  - Total users and orders
  - Revenue metrics
  - Provider health status
  - Success rates
  - System health

## Common Issues

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
pg_isready

# Restart PostgreSQL
brew services restart postgresql  # macOS
sudo service postgresql restart   # Linux
```

### Redis Connection Failed

```bash
# Check Redis is running
redis-cli ping

# Should return PONG

# Restart Redis
brew services restart redis  # macOS
sudo service redis restart   # Linux
```

### Prisma Client Not Generated

```bash
cd backend
pnpm prisma generate
```

### Missing Dependencies

```bash
# Root
pnpm install

# Backend
cd backend && pnpm install
```

## Testing

### Test Registration

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "userName": "testuser"
  }'
```

### Test Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

### Test Order Creation

```bash
# First get token from login, then:
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "serviceCode": "whatsapp",
    "country": "US"
  }'
```

## Performance Tuning

### PostgreSQL

```sql
-- Increase connections for high traffic
ALTER SYSTEM SET max_connections = 500;
ALTER SYSTEM SET shared_buffers = '2GB';
SELECT pg_reload_conf();
```

### Redis

```bash
# Edit redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
```

### Node.js

```bash
# Increase memory limit
NODE_OPTIONS=--max-old-space-size=4096 node dist/index.js
```

## Backup

### Database Backup

```bash
# Backup
pg_dump -U postgres darnumber > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres darnumber < backup_20240115.sql
```

### Redis Backup

```bash
# Redis automatically saves to dump.rdb
# Copy dump.rdb file for backup
cp /var/lib/redis/dump.rdb /backup/redis_$(date +%Y%m%d).rdb
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets (256-bit random)
- [ ] Enable HTTPS in production
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable Stripe webhook signature verification
- [ ] Use environment variables for all secrets
- [ ] Enable CloudWatch logging
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Use read replicas for database
- [ ] Enable Redis password protection

## Support

For issues, contact:

- Email: support@yourdomain.com
- GitHub Issues: [repository]/issues
- Documentation: https://docs.yourdomain.com
