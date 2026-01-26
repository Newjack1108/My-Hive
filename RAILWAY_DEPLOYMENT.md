# Railway Deployment Guide

## Prerequisites

1. Railway account (https://railway.app)
2. GitHub repository with this codebase

## Step 1: Create Railway Project

1. Log in to Railway
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

## Step 2: Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will provision a PostgreSQL instance
4. Note the `DATABASE_URL` from the database service variables

## Step 3: Configure Environment Variables

In your Railway project settings, add the following environment variables:

### For API Service:

- `DATABASE_URL` - Use the `DATABASE_URL` from your PostgreSQL service
- `JWT_SECRET` - Generate a strong random secret (e.g., using `openssl rand -base64 32`)
- `PORT` - Set to `3001` (or Railway will auto-assign via `PORT` env var)
- `NODE_ENV` - Set to `production`
- `CORS_ORIGIN` - Set to your frontend domain (e.g., `https://your-app.railway.app`)

### For Web Service (if deploying separately):

- `VITE_API_URL` - Set to your API service URL (e.g., `https://your-api.railway.app`)

## Step 4: Configure Build and Start Commands

### For API Service:

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm run db:migrate && node apps/api/dist/index.js
```

### For Web Service (if deploying separately):

**Build Command:**
```bash
npm install && npm run build
```

**Start Command:**
```bash
npm run preview
```

Or use a static file server like `npx serve -s dist -l 3000`

## Step 5: Deploy

1. Railway will automatically detect changes and deploy
2. Check the deployment logs for any errors
3. Run the seed script manually if needed:

```bash
railway run npm run db:seed
```

Or via Railway dashboard:
- Go to your database service
- Open the shell/terminal
- Run: `npm run db:seed`

## Step 6: Set Up Custom Domain (Optional)

1. In Railway project settings, go to "Domains"
2. Add a custom domain or use Railway's generated domain
3. Update `CORS_ORIGIN` to match your domain

## Step 7: NFC URL Configuration

For NFC deep-linking to work:

1. Use your Railway domain (or custom domain) as the base URL
2. NFC tags should contain URLs like: `https://your-domain.com/h/HIVE-001`
3. The app will handle authentication and routing automatically

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correctly set
- Ensure PostgreSQL service is running
- Check that migrations ran successfully

### Build Failures

- Ensure all dependencies are in `package.json`
- Check that TypeScript compilation succeeds locally
- Review build logs in Railway dashboard

### API Not Accessible

- Check that `PORT` environment variable is set
- Verify CORS settings match your frontend domain
- Check Railway service health status

### Migration Errors

- Ensure database is accessible
- Check migration logs for specific errors
- You may need to manually run migrations via Railway shell

## Running Migrations on Railway

There are several ways to run database migrations on Railway:

### Method 1: Via API Endpoint (Recommended)

1. Make sure you're logged in as an admin user
2. Call the migration endpoint:
   ```bash
   curl -X POST https://your-api.railway.app/api/migrations/run \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

   Or use the Railway CLI:
   ```bash
   railway run curl -X POST http://localhost:3001/api/migrations/run \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

3. Check migration status:
   ```bash
   curl https://your-api.railway.app/api/migrations/status \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

### Method 2: Via Railway CLI

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Link to your project: `railway link`
4. Run migrations:
   ```bash
   railway run npm run db:migrate
   ```

### Method 3: Via Railway Dashboard Shell

1. Go to your Railway project dashboard
2. Click on your API service
3. Click "Shell" or "Terminal" tab
4. Run:
   ```bash
   npm run db:migrate
   ```

### Method 4: Automatic on Deploy

Migrations are configured to run automatically on each deploy via the start command:
```bash
npm run db:migrate && node apps/api/dist/index.js
```

If migrations fail, the server will still start (to prevent deployment failures), but you should check the logs and run migrations manually if needed.

### Checking Migration Status

You can check which migrations have been applied by calling:
```bash
curl https://your-api.railway.app/api/migrations/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

This will show:
- All applied migrations with timestamps
- Pending migrations that haven't been run yet
- Total counts

## Monitoring

- Railway provides built-in logs and metrics
- Check the "Metrics" tab for CPU, memory, and request metrics
- Set up alerts for service failures

## Scaling

- Railway auto-scales based on traffic
- For high traffic, consider:
  - Upgrading to a higher tier plan
  - Separating API and web into different services
  - Using Railway's load balancing features
