# Render Deployment Configuration

## Required Environment Variables

You must set these environment variables in your Render dashboard:

### 1. Database
```
DATABASE_URL=your_postgresql_connection_string
```
- Get this from your database provider (e.g., Neon, Supabase, or Render's PostgreSQL)
- Format: `postgresql://user:password@host:port/database?sslmode=require`

### 2. AI Services
```
ANTHROPIC_API_KEY=your_anthropic_api_key
GROQ_API_KEY=your_groq_api_key
```
- Get ANTHROPIC_API_KEY from https://console.anthropic.com/
- Get GROQ_API_KEY from https://console.groq.com/

## Setting Environment Variables on Render

1. Go to your Render dashboard
2. Select your web service
3. Click on "Environment" in the left sidebar
4. Add each environment variable:
   - Click "Add Environment Variable"
   - Enter the key (e.g., `DATABASE_URL`)
   - Enter the value
   - Click "Save"

## Database Setup

After deploying, the database will be initialized automatically on the first build.

If you need to manually initialize the database:
```bash
node init-pg-db.js
```

## Troubleshooting

### 500 Errors on Generation
- Check that all environment variables are set correctly
- Verify API keys are valid and have sufficient credits
- Check Render logs for specific error messages

### Database Connection Issues
- Ensure DATABASE_URL is correctly formatted
- Verify SSL mode is set to `require` for most providers
- Check that your database is accessible from Render's servers

### Build Failures
- Ensure all dependencies are in package.json
- Check Node.js version compatibility (requires 18+)
- Review build logs for specific errors