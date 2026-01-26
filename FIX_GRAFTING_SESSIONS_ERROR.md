# Fix for Grafting Sessions 500 Error

## Problem
The `/api/queens/grafting-sessions` endpoint returns a 500 error because the `queen_grafting_sessions` table doesn't exist in the production database.

## Solution: Run Database Migration

### Option 1: Using Railway CLI

1. Install Railway CLI (if not already installed):
   ```bash
   npm i -g @railway/cli
   ```

2. Login to Railway:
   ```bash
   railway login
   ```

3. Link to your project:
   ```bash
   railway link
   ```

4. Run the migration:
   ```bash
   railway run npm run db:migrate
   ```

### Option 2: Using Railway Dashboard

1. Go to your Railway project dashboard
2. Click on your database service
3. Open the "Data" tab or "Query" tab
4. Or use the "Shell" tab to run:
   ```bash
   npm run db:migrate
   ```

### Option 3: Direct SQL (if migrations don't work)

If the migration script fails, you can run the SQL directly:

1. Go to Railway dashboard → Your database → Query tab
2. Run the SQL from `packages/db/migrations/005_add_queen_grafting_sessions.sql`

## Verify the Fix

After running the migration, check:

1. The migration should show: `✓ Applied 005_add_queen_grafting_sessions.sql`
2. Try accessing the endpoint again - it should work now
3. Check Railway logs to see if there are any errors

## Prevention

The migration script has been improved to log better error messages. However, consider:

1. Making migrations fail-fast in production (exit with error code)
2. Adding health checks that verify required tables exist
3. Monitoring migration status in deployment logs

## Improved Error Handling

The code has been updated to:
- Log detailed database errors for debugging
- Provide clearer error messages when tables are missing
- Include error codes in API responses for easier troubleshooting
