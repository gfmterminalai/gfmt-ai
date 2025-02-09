import { execSync } from 'child_process';
import { config } from '../core/config';

async function main() {
  try {
    console.log('Initializing database schema...');
    
    // Run Supabase migration
    const result = execSync('supabase db push', {
      stdio: 'inherit',
      env: {
        ...process.env,
        SUPABASE_PROJECT_ID: config.SUPABASE_PROJECT_ID,
        SUPABASE_ACCESS_TOKEN: config.SUPABASE_ACCESS_TOKEN
      }
    });

    console.log('Database schema initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    process.exit(1);
  }
}

main(); 