# Production Deployment Checklist

## Pre-Deployment

### Environment Setup

- [ ] All environment variables configured
- [ ] Strong random secrets generated for JWT
- [ ] Production database created (PostgreSQL with replicas)
- [ ] Redis instance provisioned
- [ ] AWS services configured (SES, CloudWatch)
- [ ] Stripe account in production mode
- [ ] SMS provider accounts funded

### Security

- [ ] HTTPS/SSL certificates installed
- [ ] CORS configured for production domain
- [ ] Rate limiting enabled
- [ ] Helmet.js configured
- [ ] Input validation active
- [ ] SQL injection prevention (Prisma)
- [ ] XSS protection enabled
- [ ] CSRF tokens if needed

### Database

- [ ] Migrations tested
- [ ] Indexes created for performance
- [ ] Backup strategy implemented
- [ ] Connection pooling configured
- [ ] Read replicas set up (optional)

### Infrastructure

- [ ] CDN configured (CloudFront/Vercel)
- [ ] Load balancer set up (if needed)
- [ ] Auto-scaling configured
- [ ] Health checks enabled
- [ ] Monitoring alerts set up

## Deployment Steps

### Backend Deployment

1. **Build Application**

```bash
cd backend
pnpm install --production
pnpm build
```

2. **Run Migrations**

```bash
pnpm prisma migrate deploy
```

3. **Start Application**

```bash
# With PM2
pm2 start dist/index.js --name darnumber-api -i max

# Or with systemd
sudo systemctl start darnumber-api
```

4. **Verify Health**

```bash
curl https://api.yourdomain.com/api/health
```

### Frontend Deployment

#### Vercel (Recommended)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel --prod

# 3. Set environment variables in Vercel dashboard
```

#### Manual Build

```bash
pnpm build
pnpm start
```

### Database Migration

```bash
# Production migration (no prompts)
pnpm prisma migrate deploy

# Verify
pnpm prisma migrate status
```

## Post-Deployment

### Verification

- [ ] Frontend loads correctly
- [ ] API health endpoint responds
- [ ] User registration works
- [ ] Login/authentication works
- [ ] Order creation works
- [ ] Payment processing works
- [ ] Email notifications send
- [ ] SMS delivery works
- [ ] Admin dashboard accessible

### Monitoring

- [ ] CloudWatch logs visible
- [ ] Error tracking active
- [ ] Performance metrics tracked
- [ ] Database queries optimized
- [ ] Redis cache hit rate monitored

### Testing

```bash
# Test API endpoints
curl -X POST https://api.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","userName":"testuser"}'

# Test health
curl https://api.yourdomain.com/api/health

# Test frontend
curl https://yourdomain.com
```

## Rollback Plan

### Backend Rollback

```bash
# 1. Stop current version
pm2 stop darnumber-api

# 2. Deploy previous version
pm2 start dist-backup/index.js

# 3. Rollback migrations if needed
pnpm prisma migrate resolve --rolled-back [migration_name]
```

### Database Rollback

```bash
# Restore from backup
psql -U postgres darnumber < backup_20240115.sql
```

## Monitoring & Alerts

### CloudWatch Alarms

- API error rate > 5%
- Response time > 2s
- Database connections > 80%
- Redis memory > 90%

### Email Alerts

- Payment failures
- Provider API errors
- High error rates
- System downtime

## Performance Optimization

### Caching

- [ ] Redis caching active
- [ ] CDN cache configured
- [ ] Browser caching enabled
- [ ] Database query caching

### Database

- [ ] Indexes on frequently queried fields
- [ ] Connection pooling (100+ connections)
- [ ] Prepared statements used
- [ ] Read replicas for analytics

### Node.js

- [ ] Cluster mode enabled (PM2)
- [ ] Memory limits configured
- [ ] CPU profiling done
- [ ] Event loop monitoring

## Backup Strategy

### Database Backups

```bash
# Automated daily backups
0 2 * * * pg_dump darnumber > /backups/db_$(date +\%Y\%m\%d).sql

# Retention: 7 daily, 4 weekly, 12 monthly
```

### Redis Backups

```bash
# AOF persistence enabled
# Snapshots every hour
save 3600 1
```

### Application Logs

```bash
# Rotate logs daily, keep 30 days
/app/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
}
```

## Scaling Considerations

### Horizontal Scaling

- [ ] Load balancer configured
- [ ] Session management (Redis)
- [ ] Stateless backend design
- [ ] Database read replicas

### Vertical Scaling

- [ ] CPU/RAM monitoring
- [ ] Auto-scaling rules
- [ ] Resource limits set

### Database Scaling

- [ ] Connection pooling
- [ ] Read replicas
- [ ] Query optimization
- [ ] Partitioning strategy

## Cost Optimization

### AWS

- [ ] Use reserved instances
- [ ] Enable auto-scaling
- [ ] S3 lifecycle policies
- [ ] CloudWatch log retention

### Database

- [ ] Right-size instances
- [ ] Use read replicas wisely
- [ ] Archive old data
- [ ] Optimize queries

### Redis

- [ ] Use appropriate instance size
- [ ] Enable data eviction policies
- [ ] Monitor memory usage

## Security Hardening

### Network

- [ ] Firewall rules configured
- [ ] VPC setup (AWS)
- [ ] Private subnets for database
- [ ] Security groups configured

### Application

- [ ] Secrets in environment variables
- [ ] No secrets in code
- [ ] Dependencies updated
- [ ] Security headers set

### Database

- [ ] Strong passwords
- [ ] SSL connections only
- [ ] Limited permissions per user
- [ ] Regular backups

## Compliance

### GDPR (if applicable)

- [ ] User data deletion endpoint
- [ ] Data export functionality
- [ ] Privacy policy updated
- [ ] Cookie consent

### PCI DSS (for payments)

- [ ] Stripe handles card data
- [ ] No card storage
- [ ] Secure transmission (HTTPS)
- [ ] Audit logging

## Documentation

### Internal

- [ ] API documentation
- [ ] Architecture diagrams
- [ ] Deployment procedures
- [ ] Incident response plan

### External

- [ ] User guides
- [ ] API documentation
- [ ] Terms of service
- [ ] Privacy policy

## Support Plan

### On-Call

- [ ] Rotation schedule
- [ ] Escalation procedures
- [ ] Contact information
- [ ] Runbooks

### Monitoring

- [ ] 24/7 monitoring
- [ ] Alert notifications
- [ ] Status page
- [ ] Incident tracking

## Success Metrics

### Performance

- API response time < 200ms (p95)
- SMS delivery < 30s (p95)
- Uptime > 99.9%
- Error rate < 0.1%

### Business

- User registration rate
- Order completion rate
- Revenue per user
- Customer satisfaction

## Post-Launch

### Week 1

- [ ] Monitor error logs daily
- [ ] Check performance metrics
- [ ] Verify all integrations
- [ ] User feedback review

### Month 1

- [ ] Performance optimization
- [ ] Cost analysis
- [ ] Feature usage analysis
- [ ] Security audit

### Ongoing

- [ ] Weekly performance reviews
- [ ] Monthly security updates
- [ ] Quarterly cost optimization
- [ ] Continuous improvement
