# Database Migration Guide

This guide explains how to run database migrations on Railway and other platforms.

## Quick Start

### On Railway (Recommended Methods)

#### Method 1: Via API Endpoint (Easiest)

1. **Get your JWT token** (log in to the app and check browser dev tools, or use the login endpoint)
2. **Call the migration endpoint:**
   ```bash
   curl -X POST https://your-api.railway.app/api/migrations/run \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json"
   ```

3. **Check status:**
   ```bash
   curl https://your-api.railway.app/api/migrations/status \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

#### Method 2: Via Railway CLI

1. Install Railway CLI:
   ```bash
   npm i -g @railway/cli
   ```

2. Login and link:
   ```bash
   railway login
   railway link
   ```

3. Run migrations:
   ```bash
   railway run npm run db:migrate
   ```

#### Method 3: Via Railway Dashboard Shell

1. Go to Railway dashboard → Your project → API service
2. Click "Shell" or "Terminal" tab
3. Run:
   ```bash
   npm run db:migrate
   ```

### Local Development

```bash
npm run db:migrate
```

Or directly:
```bash
node packages/db/migrate.js
```

## Migration Endpoints

### POST `/api/migrations/run`

Runs all pending migrations. **Admin only.**

**Request:**
```bash
POST /api/migrations/run
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Migrations completed successfully",
  "output": "...",
  "warnings": null
}
```

### GET `/api/migrations/status`

Returns the status of all migrations. **Admin only.**

**Request:**
```bash
GET /api/migrations/status
Authorization: Bearer <admin_jwt_token>
```

**Response:**
```json
{
  "applied": [
    {
      "filename": "001_initial_schema.sql",
      "applied_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pending": ["009_add_hive_splits.sql"],
  "total": 9,
  "appliedCount": 8,
  "pendingCount": 1
}
```

## Automatic Migrations

Migrations are configured to run automatically on each Railway deployment via the start command:

```bash
npm run db:migrate && node apps/api/dist/index.js
```

If migrations fail, the server will still start (to prevent deployment failures), but you should check the logs and run migrations manually.

## Troubleshooting

### "Migration failed" Error

1. Check the error message in the response
2. Verify `DATABASE_URL` is set correctly
3. Ensure the database is accessible
4. Check Railway logs for detailed error messages

### "Only admins can run migrations" Error

You need to be logged in as an admin user. Check your user role in the database or create an admin user.

### Migrations Not Running Automatically

1. Check Railway deployment logs
2. Verify the start command includes `npm run db:migrate`
3. Check that `DATABASE_URL` is set in Railway environment variables

### Checking Which Migrations Are Applied

Use the status endpoint:
```bash
curl https://your-api.railway.app/api/migrations/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Migration Files

All migration files are in `packages/db/migrations/` and are named sequentially:
- `001_initial_schema.sql`
- `002_phase2_features.sql`
- `003_add_weather_to_inspections.sql`
- etc.

Migrations are tracked in the `migrations` table in your database, which prevents running the same migration twice.

## Manual Migration (Advanced)

If you need to run a specific migration manually:

1. Connect to your database (via Railway shell or psql)
2. Check the `migrations` table:
   ```sql
   SELECT * FROM migrations ORDER BY applied_at;
   ```
3. Run the SQL file directly if needed (not recommended - use the migration script instead)
