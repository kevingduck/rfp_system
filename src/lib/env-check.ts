// Environment variable validation
export function checkRequiredEnvVars() {
  const required = [
    'DATABASE_URL',
    'ANTHROPIC_API_KEY',
    'GROQ_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('=== MISSING REQUIRED ENVIRONMENT VARIABLES ===');
    console.error('The following environment variables are required but not set:');
    missing.forEach(key => {
      console.error(`  - ${key}`);
    });
    console.error('\nPlease add these to your .env.local file:');
    console.error('DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require');
    console.error('ANTHROPIC_API_KEY=your-anthropic-api-key');
    console.error('GROQ_API_KEY=your-groq-api-key');
    console.error('===========================================\n');
    
    // Don't exit the process, just warn
    // This allows the app to start but shows clear errors
  }

  // Log successful env var loading
  const loaded = required.filter(key => process.env[key]);
  if (loaded.length > 0) {
    console.log('✓ Environment variables loaded:', loaded.join(', '));
  }
}