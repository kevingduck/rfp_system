# Deploying RFP System to Render

This project is configured for easy deployment to Render using their Blueprint feature.

## Quick Deploy with Render Blueprint

1. Push your code to GitHub (if not already done)
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New +" → "Blueprint"
4. Connect your GitHub repo (`rfp_system`)
5. Render will automatically detect the `render.yaml` file
6. Click "Apply" to create the service

## Environment Variables

After deployment, you need to set the `ANTHROPIC_API_KEY` in the Render dashboard:

1. Go to your service in Render
2. Click "Environment" in the left sidebar
3. Add your `ANTHROPIC_API_KEY` value
4. The service will automatically restart

## What's Included

- **Persistent Disk**: 1GB for database and uploads
- **Health Check**: Endpoint at `/api/health`
- **Auto-build**: Runs database migrations and builds Next.js
- **Node 18+**: Uses latest Node.js runtime

## File Structure for Render

- `render.yaml` - Render Blueprint configuration
- `build.sh` - Custom build script that:
  - Creates necessary directories
  - Runs database migrations
  - Builds Next.js app
- `start.sh` - Custom start script
- `.env.example` - Example environment variables

## Database Persistence

The SQLite database is stored on a persistent disk at `/opt/render/project/src/rfp_database.db`. This ensures your data persists across deployments.

## Troubleshooting

If you encounter issues:

1. Check the Render logs for build/runtime errors
2. Ensure `ANTHROPIC_API_KEY` is set correctly
3. Verify all migration scripts run successfully
4. Check that the persistent disk is mounted correctly

## Local Development

To match the Render environment locally:

```bash
npm install
npm run setup  # Run database migrations
npm run dev     # Start development server
```