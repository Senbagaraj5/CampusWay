# CampusWay Environment Configuration

## Required API Keys

This file documents all the API keys needed to run CampusWay with full functionality.

### 1. Google Maps API Key

**What it is**: Authentication key for Google Maps services

**Get it at**: https://console.cloud.google.com/
- Create a new project
- Enable these APIs:
  - Maps JavaScript API
  - Directions API
  - Distance Matrix API
- Create an API key
- Add restrictions (recommended)

**Set in .env**:
```
VITE_GOOGLE_MAPS_API_KEY=AIzaSyD...your_key_here...
```

**Used for**:
- Display interactive maps
- Calculate routes between locations
- Show live traffic layers
- Calculate distances and ETAs

---

### 2. Gemini API Key (Google AI)

**What it is**: Authentication key for Google's Gemini AI model

**Get it at**: https://ai.google.dev/
- Sign up with Google account
- Create new API key
- Copy the key

**Set in .env**:
```
GEMINI_API_KEY=sk-...your_key_here...
```

**Used for**:
- Smart ETA calculations
- Route assistance
- Traffic analysis
- Chat support responses
- Alternative route suggestions

---

## Quick Setup

1. Create `.env` file in root directory

2. Add both API keys:
```env
# Google Maps - For live tracking
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key

# Gemini AI - For smart features  
GEMINI_API_KEY=your_gemini_key
```

3. Save and restart dev server:
```bash
npm run dev
```

---

## Security Tips

✅ **DO:**
- Keep .env file in .gitignore (it is by default)
- Use different keys for dev and production
- Restrict API keys to your domains
- Monitor API usage
- Rotate keys periodically

❌ **DON'T:**
- Commit .env to version control
- Share your API keys
- Use the same key for multiple projects
- Leave API keys unrestricted
- Hardcode keys in source code

---

## Cost Information

### Google Maps API Pricing
- Maps JavaScript API: $7 per 1,000 sessions (first 25,000 free/month)
- Directions API: $5 per 1,000 requests (first 25,000 free/month)
- Distance Matrix: $5 per 1,000 elements (first 25,000 free/month)
- Estimated monthly: $50-200 for a campus of 50 buses, 1000 students

### Gemini API Pricing
- Text generation: $0.075 per 1M input tokens
- Text generation: $0.30 per 1M output tokens
- (First 50 requests per day free)
- Estimated monthly: $10-50 for campus scale

---

## Testing Without Real Keys

If you don't have keys yet:

1. Map will show error message but app runs
2. Location tracking still works with browser geolocation
3. ETA calculations use fallback (15 km/h average)
4. Chat features won't work
5. Traffic layer won't display

---

## Troubleshooting

**"Invalid or missing API Key"**
- Check .env file exists in root
- Check key is correct (copy without quotes)
- Restart dev server after adding key

**"Map failed to load"**
- Verify Maps JavaScript API is enabled
- Check API key restrictions
- Clear browser cache
- Check internet connection

**"Chat not working"**
- Verify Gemini API key is set
- Check API has library access
- Log out/in on https://ai.google.dev

**"ETA returning 0"**
- Use mock value (15 km/h) if Gemini key missing
- Just distance/15 km/h = ETA

---

## Advanced: Environment-Specific Keys

```env
# .env (development)
VITE_GOOGLE_MAPS_API_KEY=dev_key_123
GEMINI_API_KEY=dev_gemini_123

# .env.production (production)
VITE_GOOGLE_MAPS_API_KEY=prod_key_456
GEMINI_API_KEY=prod_gemini_456

# .env.staging (staging)
VITE_GOOGLE_MAPS_API_KEY=staging_key_789
GEMINI_API_KEY=staging_gemini_789
```

---

For detailed setup instructions, see [GOOGLE_MAPS_SETUP.md](GOOGLE_MAPS_SETUP.md)

For architecture details, see [LIVE_TRACKING.md](LIVE_TRACKING.md)
