import cron from 'node-cron';
import { spawn } from 'child_process';
import path from 'path';

// Schedule tasks to be run on the server
console.log('Starting cron job scheduler...');

let currentProcess: ReturnType<typeof spawn> | null = null;

const runSync = () => {
  console.log('Running sync job:', new Date().toISOString());
  
  // Kill any existing sync process
  if (currentProcess) {
    try {
      currentProcess.kill();
    } catch (error) {
      console.error('Error killing existing process:', error);
    }
  }
  
  // Get absolute paths
  const scriptDir = path.resolve(__dirname);
  const scriptPath = path.join(scriptDir, 'sync.ts');
  const tsNodeBin = path.join(process.cwd(), 'node_modules', '.bin', 'ts-node');
  
  console.log('Script path:', scriptPath);
  
  // Use spawn instead of exec for better handling of output
  currentProcess = spawn(tsNodeBin, [scriptPath], {
    stdio: 'inherit', // This will pipe the output directly to our console
    cwd: process.cwd()
  });

  currentProcess.on('error', (error) => {
    console.error('Failed to start sync process:', error);
    currentProcess = null;
  });

  currentProcess.on('exit', (code, signal) => {
    if (code !== 0) {
      console.error(`Sync process exited with code ${code}`);
    }
    currentProcess = null;
  });
};

// Run immediately
console.log('Running initial sync...');
runSync();

// Then run every hour
console.log('Scheduling hourly sync...');
const job = cron.schedule('0 * * * *', runSync);

// Keep the process alive and handle termination
process.on('SIGINT', () => {
  console.log('Received SIGINT. Cleaning up...');
  if (currentProcess) {
    currentProcess.kill();
  }
  job.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Cleaning up...');
  if (currentProcess) {
    currentProcess.kill();
  }
  job.stop();
  process.exit(0);
});

// Prevent the process from exiting
process.stdin.resume(); 