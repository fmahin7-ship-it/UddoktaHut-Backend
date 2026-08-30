# Deployment Guide

This document provides comprehensive instructions for deploying the UddoktaHut Backend to various environments, including development, staging, and production setups.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Docker Deployment](#docker-deployment)
- [Cloud Platform Deployment](#cloud-platform-deployment)
- [Database Migration](#database-migration)
- [Environment Variables](#environment-variables)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Backup Strategy](#backup-strategy)
- [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### System Requirements

#### Minimum Requirements

- **CPU**: 2 vCPUs (4 recommended)
- **RAM**: 2GB (4GB+ recommended)
- **Storage**: 20GB SSD
- **Network**: 1Gbps connection

#### Software Requirements

- **Node.js**: 18.0+ (LTS recommended)
- **npm**: 8.0+ or **yarn**: 1.22+
- **PostgreSQL**: 12.0+ (14.0+ recommended)
- **Git**: 2.30+

#### Optional Tools

- **Docker**: 20.10+ (for containerized deployment)
- **nginx**: 1.20+ (reverse proxy)
- **PM2**: 5.0+ (process management)
- **Redis**: 6.0+ (caching - future enhancement)

## 🔧 Environment Setup

### Development Environment

#### 1. Clone Repository

```bash
git clone https://github.com/fmahin7-ship-it/UddoktaHut-Backend.git
cd UddoktaHut-Backend
```

#### 2. Install Dependencies

```bash
# Using npm
npm install

# Using yarn
yarn install
```

#### 3. Database Setup

```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Install PostgreSQL (macOS with Homebrew)
brew install postgresql
brew services start postgresql

# Create database
sudo -u postgres createdb uddoktahut_development
```

#### 4. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database Configuration
DB_NAME=uddoktahut_development
DB_USER=postgres
DB_PASS=your_password
DB_HOST=localhost
DB_PORT=5432
DB_DIALECT=postgres

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=4000
NODE_ENV=development

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Analytics AI (required for /ai/query and intent seeding)
OPENAI_API_KEY=sk-...
AI_PROVIDER=openai
# AI_USE_TOOLS=true
# AI_INTENT_RESOLUTION=true
# AI_INTENT_AUTO_RUN=true
# AI_RATE_LIMIT_MAX=10

# Langfuse tracing (optional)
# LANGFUSE_PUBLIC_KEY=
# LANGFUSE_SECRET_KEY=
# LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

#### 5. Database Migration

```bash
# Run migrations (includes pgvector + tool_routing + plan entitlements)
npm run migrate

# Seed roles/plans and other seeders
npm run seed-all

# Seed intent utterance embeddings (needs OPENAI_API_KEY)
npm run seed-intent-utterances
```

Skip the intent seed if you are not using analytics AI locally.

#### 6. Start Development Server

```bash
# Development with hot reload
npm run dev

# Production mode
npm start
```

### Testing Environment Setup

```bash
# Create test database
createdb uddoktahut_test

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 🚀 Production Deployment

### Production Server Setup

#### 1. Server Preparation (Ubuntu 20.04/22.04)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install nginx (reverse proxy)
sudo apt install nginx

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Git
sudo apt install git
```

#### 2. User and Directory Setup

```bash
# Create application user
sudo adduser --system --group uddoktahut
sudo mkdir -p /var/www/uddoktahut
sudo chown uddoktahut:uddoktahut /var/www/uddoktahut
```

#### 3. Application Deployment

```bash
# Switch to app user
sudo -u uddoktahut -i

# Clone application
cd /var/www/uddoktahut
git clone https://github.com/fmahin7-ship-it/UddoktaHut-Backend.git .

# Install dependencies (production only)
npm ci --only=production

# Copy and configure environment
cp .env.example .env
# Edit .env with production values
nano .env
```

#### 4. Database Setup (Production)

```bash
# Create production database
sudo -u postgres createdb uddoktahut_production

# Create database user
sudo -u postgres psql -c "CREATE USER uddoktahut WITH ENCRYPTED PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE uddoktahut_production TO uddoktahut;"

# Run migrations
NODE_ENV=production npm run migrate
```

#### 5. PM2 Process Management

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "uddoktahut-backend",
      script: "main.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      error_file: "/var/log/pm2/uddoktahut-error.log",
      out_file: "/var/log/pm2/uddoktahut-out.log",
      log_file: "/var/log/pm2/uddoktahut-combined.log",
      time: true,
      max_memory_restart: "1G",
      node_args: "--max_old_space_size=1024",
    },
  ],
};
```

Start the application:

```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u uddoktahut --hp /home/uddoktahut
```

#### 6. Nginx Configuration

Create `/etc/nginx/sites-available/uddoktahut`:

```nginx
upstream app {
    server 127.0.0.1:4000;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.pem;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location / {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://app/health;
    }

    # Static file handling (if needed)
    location /static/ {
        alias /var/www/uddoktahut/static/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/uddoktahut /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 🐳 Docker Deployment

### Dockerfile

Create `Dockerfile`:

```dockerfile
# Multi-stage build for smaller production image
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
WORKDIR /app

# Create app user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 4000

CMD ["node", "main.js"]
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: "3.8"

services:
  app:
    build:
      context: .
      target: production
    container_name: uddoktahut-backend
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DB_HOST=db
      - DB_NAME=uddoktahut_production
      - DB_USER=postgres
      - DB_PASS=secure_password
    depends_on:
      - db
    restart: unless-stopped
    networks:
      - app-network

  db:
    image: postgres:14-alpine
    container_name: uddoktahut-db
    environment:
      - POSTGRES_DB=uddoktahut_production
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    container_name: uddoktahut-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
    networks:
      - app-network

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
```

### Development with Docker Compose

Create `docker-compose.dev.yml`:

```yaml
version: "3.8"

services:
  app:
    build:
      context: .
      target: dev
    container_name: uddoktahut-dev
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=development
      - DB_HOST=db
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - db
    networks:
      - dev-network

  db:
    image: postgres:14-alpine
    container_name: uddoktahut-dev-db
    environment:
      - POSTGRES_DB=uddoktahut_development
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - dev_postgres_data:/var/lib/postgresql/data
    ports:
      - "5433:5432"
    networks:
      - dev-network

volumes:
  dev_postgres_data:

networks:
  dev-network:
    driver: bridge
```

### Docker Commands

```bash
# Development
docker-compose -f docker-compose.dev.yml up --build

# Production
docker-compose up -d --build

# View logs
docker-compose logs -f app

# Run migrations
docker-compose exec app npm run migrate

# Scale application
docker-compose up --scale app=3
```

## ☁️ Cloud Platform Deployment

### AWS Deployment (EC2 + RDS)

#### 1. EC2 Instance Setup

```bash
# Launch EC2 instance (Ubuntu 22.04 LTS)
# t3.medium or larger recommended

# Security Group Rules:
# SSH: 22 (your IP)
# HTTP: 80 (0.0.0.0/0)
# HTTPS: 443 (0.0.0.0/0)
# Custom: 4000 (internal only)
```

#### 2. RDS PostgreSQL Setup

```bash
# Create RDS instance
# Engine: PostgreSQL 14
# Instance class: db.t3.micro (or larger)
# Storage: 20GB SSD
# Multi-AZ: No (for development)
# Public access: No
# VPC Security Group: Allow port 5432 from EC2
```

#### 3. Environment Variables (AWS)

```bash
# Database connection
DB_HOST=your-rds-endpoint.amazonaws.com
DB_NAME=uddoktahut_production
DB_USER=postgres
DB_PASS=your-secure-password

# AWS specific
AWS_REGION=us-east-1
```

### Heroku Deployment

#### 1. Heroku Setup

```bash
# Install Heroku CLI
# Create Heroku app
heroku create uddoktahut-backend

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret-key

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
```

#### 2. Procfile

Create `Procfile`:

```
web: node main.js
```

### DigitalOcean App Platform

Create `app.yaml`:

```yaml
name: uddoktahut-backend

services:
  - name: api
    source_dir: /
    github:
      repo: fmahin7-ship-it/UddoktaHut-Backend
      branch: main
    run_command: node main.js
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: basic-xxs
    envs:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: "8080"

databases:
  - name: uddoktahut-db
    engine: PG
    version: "14"
    size: db-s-dev-database
```

## 🗄️ Database Migration

### Production Migration Strategy

#### 1. Pre-deployment Checklist

```bash
# Backup production database
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > backup_$(date +%Y%m%d_%H%M%S).sql

# Test migrations on staging
NODE_ENV=staging npm run migrate

# Verify data integrity
npm run db:validate
```

#### 2. Zero-downtime Migration

```bash
# Create migration script
cat > scripts/migrate.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting database migration..."

# Backup database
pg_dump $DATABASE_URL > "backup_$(date +%Y%m%d_%H%M%S).sql"

# Run migrations
npm run migrate

# Verify migrations
npm run db:status

echo "Migration completed successfully"
EOF

chmod +x scripts/migrate.sh
```

#### 3. Rollback Strategy

```bash
# Rollback last migration
npm run migrate:undo

# Rollback to specific migration
npx sequelize-cli db:migrate:undo:all --to 20241001000000-create-users.cjs

# Restore from backup
psql $DATABASE_URL < backup_20241019_120000.sql
```

## 🌍 Environment Variables

### Production Environment Template

```env
# Application
NODE_ENV=production
PORT=4000
APP_NAME=UddoktaHut Backend
APP_VERSION=1.0.0

# Database
DATABASE_URL=postgresql://user:password@host:port/database
DB_NAME=uddoktahut_production
DB_USER=uddoktahut
DB_PASS=secure_random_password
DB_HOST=localhost
DB_PORT=5432
DB_DIALECT=postgres
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000

# Authentication
JWT_SECRET=super-secure-random-string-min-32-characters
JWT_EXPIRES_IN=7d
JWT_ISSUER=uddoktahut
JWT_AUDIENCE=uddoktahut-users

# Security
CORS_ORIGIN=https://your-frontend-domain.com
HELMET_ENABLED=true
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Email Service
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@uddoktahut.com

# SMS Service (Optional)
SMS_API_KEY=your-sms-api-key
SMS_SENDER=UddoktaHut

# Analytics AI
OPENAI_API_KEY=sk-...
AI_PROVIDER=openai
AI_USE_TOOLS=true
AI_INTENT_RESOLUTION=true
AI_INTENT_AUTO_RUN=true
AI_RATE_LIMIT_MAX=10

# Langfuse (optional — query tracing)
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/uddoktahut/app.log

# Monitoring
SENTRY_DSN=your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-newrelic-key

# File Storage (Optional)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
AWS_S3_BUCKET=uddoktahut-uploads
AWS_REGION=us-east-1
```

## 🔒 SSL/TLS Configuration

### Let's Encrypt (Free SSL)

#### 1. Install Certbot

```bash
# Ubuntu/Debian
sudo apt install certbot python3-certbot-nginx

# CentOS/RHEL
sudo yum install certbot python3-certbot-nginx
```

#### 2. Generate Certificate

```bash
# Generate SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run

# Setup automatic renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

#### 3. SSL Configuration

```nginx
# Strong SSL configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;

# HSTS
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## 📊 Monitoring & Logging

### Application Monitoring

#### 1. PM2 Monitoring

```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs uddoktahut-backend

# Restart application
pm2 restart uddoktahut-backend

# Reload with zero downtime
pm2 reload uddoktahut-backend
```

#### 2. Health Check Endpoint

Add to `main.js`:

```javascript
// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || "1.0.0",
  });
});
```

#### 3. Logging Configuration

```javascript
// config/logger.js
const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

module.exports = logger;
```

### System Monitoring

#### 1. Server Monitoring Script

Create `scripts/monitor.sh`:

```bash
#!/bin/bash

# System resource monitoring
echo "=== System Resources ==="
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}'

echo "Memory Usage:"
free -m | awk 'NR==2{printf "%.2f%%\n", $3*100/$2 }'

echo "Disk Usage:"
df -h | awk '$NF=="/"{printf "%s\n", $5}'

echo "=== Application Status ==="
pm2 status uddoktahut-backend

echo "=== Database Connections ==="
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

#### 2. Automated Monitoring with cron

```bash
# Add to crontab
*/5 * * * * /path/to/scripts/monitor.sh >> /var/log/uddoktahut/monitor.log 2>&1
```

## 💾 Backup Strategy

### Database Backup

#### 1. Automated Backup Script

Create `scripts/backup.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/uddoktahut"
DB_NAME="uddoktahut_production"
DB_USER="uddoktahut"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup filename
BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sql"

# Perform backup
pg_dump -h localhost -U $DB_USER -d $DB_NAME > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Remove old backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

#### 2. Schedule Backups

```bash
# Daily backups at 2 AM
0 2 * * * /path/to/scripts/backup.sh

# Weekly full backup
0 1 * * 0 /path/to/scripts/full-backup.sh
```

### Application Backup

```bash
#!/bin/bash
# Backup application code and uploads
tar -czf /var/backups/uddoktahut/app_backup_$(date +%Y%m%d).tar.gz \
  /var/www/uddoktahut \
  --exclude=node_modules \
  --exclude=logs
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check application logs
pm2 logs uddoktahut-backend

# Check system resources
htop
df -h

# Check database connection
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"

# Restart application
pm2 restart uddoktahut-backend
```

#### 2. Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log

# Test connection
telnet $DB_HOST $DB_PORT

# Check firewall
sudo ufw status
```

#### 3. Memory Issues

```bash
# Check memory usage
free -m
ps aux --sort=-%mem | head

# Increase swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 4. Performance Issues

```bash
# Check slow queries
sudo tail -f /var/log/postgresql/postgresql-14-main.log | grep "slow query"

# Monitor API response times
curl -w "@curl-format.txt" -o /dev/null https://your-domain.com/api/health

# Check nginx access logs
sudo tail -f /var/log/nginx/access.log
```

### Debugging Tools

#### 1. Debug Mode

```bash
# Enable debug logging
DEBUG=* NODE_ENV=development npm start

# Database query logging
DB_LOGGING=true npm start
```

#### 2. Performance Profiling

```javascript
// Add to main.js for debugging
const v8Profiler = require("v8-profiler-next");

if (process.env.NODE_ENV === "debug") {
  v8Profiler.startProfiling("CPU profile");

  setTimeout(() => {
    const profile = v8Profiler.stopProfiling("CPU profile");
    profile.export(function (error, result) {
      fs.writeFileSync("profile.cpuprofile", result);
      profile.delete();
    });
  }, 30000);
}
```

### Rollback Procedures

#### 1. Application Rollback

```bash
# Rollback to previous version
git checkout previous-commit-hash
npm ci --only=production
pm2 restart uddoktahut-backend
```

#### 2. Database Rollback

```bash
# Rollback migrations
npm run migrate:undo

# Restore from backup
psql $DATABASE_URL < backup_file.sql
```

---

This deployment guide provides comprehensive instructions for setting up UddoktaHut Backend in various environments with proper monitoring, security, and backup strategies.
