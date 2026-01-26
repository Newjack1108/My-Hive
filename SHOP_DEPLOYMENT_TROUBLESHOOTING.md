# Shop Deployment Troubleshooting Guide

## Issue: Shop changes not appearing after hard refresh and server restart

### Step 1: Clear Service Worker Cache

The PWA service worker may be caching the old version. Clear it:

**In Browser DevTools:**
1. Open DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Service Workers** in the left sidebar
4. Click **Unregister** for your service worker
5. Go to **Cache Storage** and delete all caches
6. Go to **Clear Storage** and click **Clear site data**
7. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

**Alternative - Disable Service Worker temporarily:**
- In DevTools → Application → Service Workers
- Check "Bypass for network" to bypass service worker

### Step 2: Verify Railway Deployment

1. **Check Railway Deployment Logs:**
   - Go to Railway dashboard
   - Check the latest deployment logs
   - Verify build completed: `npm install && npm run build`
   - Verify migrations ran: `npm run db:migrate`

2. **Verify Build Output:**
   - Check that `apps/web/dist` folder exists in deployment
   - Verify `apps/api/dist` folder exists

3. **Check Environment Variables:**
   - Verify `DATABASE_URL` is set
   - Verify `JWT_SECRET` is set
   - Verify `CORS_ORIGIN` matches your domain
   - Verify Cloudinary variables are set (if using image uploads)

### Step 3: Test API Endpoints Directly

Test if shop API is working:

```bash
# Get your Railway API URL
# Then test:
curl -H "Authorization: Bearer YOUR_TOKEN" https://your-api.railway.app/api/shop/products
```

Or use browser DevTools → Network tab:
- Navigate to shop page
- Check if `/api/shop/products` returns data
- Check for any 404 or 500 errors

### Step 4: Verify Frontend Build Includes Shop

1. **Check Built Files:**
   - In Railway, check if `apps/web/dist/index.html` exists
   - Verify `apps/web/dist/assets/index-*.js` contains shop code

2. **Check Browser Console:**
   - Open DevTools → Console
   - Look for JavaScript errors
   - Check Network tab for failed requests

### Step 5: Force New Deployment

If changes still don't appear:

1. **Trigger new deployment:**
   ```bash
   git commit --allow-empty -m "Force rebuild"
   git push origin main
   ```

2. **Or redeploy in Railway:**
   - Go to Railway dashboard
   - Click "Redeploy" on your service

### Step 6: Verify Routes Are Registered

Check that shop routes are in the built frontend:
- Open `apps/web/dist/index.html` in Railway
- Search for "shop" to verify routes are included

### Step 7: Check API Route Registration

Verify shop router is registered in API:
- Check `apps/api/src/index.ts` line 68: `app.use('/api/shop', shopRouter);`
- Verify this is in the built `apps/api/dist/index.js`

## Quick Fixes

### Clear All Caches (Browser)
1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

### Verify Shop is Accessible
1. Navigate to: `https://your-domain.com/shop`
2. Check browser console for errors
3. Check Network tab for API calls

### Test API Directly
```bash
# Replace with your actual token and URL
curl -X GET https://your-api.railway.app/api/shop/products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Common Issues

1. **Service Worker Cache**: Most common issue - clear it
2. **Build Not Deployed**: Check Railway deployment logs
3. **API Not Running**: Check Railway service status
4. **CORS Issues**: Verify `CORS_ORIGIN` environment variable
5. **Missing Environment Variables**: Check Railway env vars

## Still Not Working?

1. Check Railway logs for errors
2. Verify database migrations completed
3. Test API endpoints with Postman/curl
4. Check browser console for JavaScript errors
5. Verify you're accessing the correct domain
