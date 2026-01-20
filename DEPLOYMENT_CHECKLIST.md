# Deployment Checklist

## Pre-Deployment

- [ ] All environment variables configured in Railway
- [ ] Database migrations tested locally
- [ ] Seed script tested
- [ ] Build commands work locally
- [ ] API endpoints tested
- [ ] Frontend builds successfully
- [ ] PWA service worker registered
- [ ] Offline functionality tested

## Railway Configuration

### Database Service
- [ ] PostgreSQL service created
- [ ] `DATABASE_URL` environment variable set

### API Service
- [ ] Environment variables:
  - [ ] `DATABASE_URL` (from PostgreSQL service)
  - [ ] `JWT_SECRET` (strong random string)
  - [ ] `PORT` (usually auto-assigned)
  - [ ] `NODE_ENV=production`
  - [ ] `CORS_ORIGIN` (your frontend domain)
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm run db:migrate && node apps/api/dist/index.js`

### Web Service (if separate)
- [ ] Environment variables:
  - [ ] `VITE_API_URL` (your API service URL)
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npx serve -s dist -l 3000` (or similar)

## Post-Deployment

- [ ] Run database migrations: `railway run npm run db:migrate`
- [ ] Run seed script: `railway run npm run db:seed`
- [ ] Test API health endpoint: `GET /health`
- [ ] Test login functionality
- [ ] Test NFC deep-link: `https://your-domain.com/h/HIVE-001`
- [ ] Test offline inspection creation
- [ ] Test sync when coming back online
- [ ] Verify PWA installation on mobile
- [ ] Test photo upload
- [ ] Verify admin panel access

## NFC Tag Setup

1. Program NFC tags with URLs in format: `https://your-domain.com/h/{hive_public_id}`
2. Test tapping tags on iPhone Safari
3. Verify authentication redirect works
4. Verify hive dashboard loads correctly

## Monitoring

- [ ] Set up error alerts in Railway
- [ ] Monitor API response times
- [ ] Check database connection pool usage
- [ ] Monitor sync queue for failed items
- [ ] Review activity logs regularly

## Security

- [ ] JWT_SECRET is strong and unique
- [ ] CORS_ORIGIN restricts to your domains only
- [ ] Database credentials are secure
- [ ] HTTPS is enabled (Railway default)
- [ ] Admin users have strong passwords

## Testing Checklist

### Auth Flow
- [ ] Login with valid credentials
- [ ] Login fails with invalid credentials
- [ ] Token refresh works
- [ ] Logout clears session

### Admin Panel
- [ ] Admin can create users
- [ ] Admin can assign roles
- [ ] Admin can view all apiaries/hives
- [ ] Non-admin users cannot access admin panel

### Inspections
- [ ] Create inspection online
- [ ] Create inspection offline
- [ ] Auto-save draft works
- [ ] Sync when coming online
- [ ] Location capture works
- [ ] All sections save correctly

### Photos
- [ ] Upload photo
- [ ] Photo resizes correctly
- [ ] Thumbnail generated
- [ ] Photo displays in inspection

### Offline Sync
- [ ] Queue inspection for sync
- [ ] Sync when online
- [ ] Handle duplicate submissions
- [ ] Retry failed syncs
