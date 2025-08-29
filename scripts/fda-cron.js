// scripts/fda-cron.js
const cron = require('node-cron');
const fetch = require('node-fetch');

// Configuration
const config = {
  baseUrl: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000'
    : process.env.NEXT_PUBLIC_BASE_URL || 'https://your-app.vercel.app',
  cronSchedule: '*/10 * * * *', // Every 10 minutes
  enabled: process.env.FDA_CRON_ENABLED !== 'false', // Can disable via env var
  limit: parseInt(process.env.FDA_FETCH_LIMIT) || 25
};

let isRunning = false;
let lastRun = null;
let runCount = 0;
let errorCount = 0;

// Fetch FDA news function
async function fetchFDANews() {
  if (isRunning) {
    console.log('⏳ Previous fetch still running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = new Date();
  
  try {
    console.log(`\n🚀 [${startTime.toISOString()}] Starting FDA news fetch #${runCount + 1}`);
    
    const response = await fetch(`${config.baseUrl}/api/admin/trigger-pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FDA-Cron-Job'
      },
      body: JSON.stringify({
        action: 'full',
        limit: config.limit
      }),
      timeout: 300000 // 5 minute timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const duration = Date.now() - startTime.getTime();

    if (result.success) {
      runCount++;
      lastRun = startTime;
      
      console.log('✅ FDA fetch completed successfully');
      console.log(`📊 Summary: ${result.summary?.ingested || 0} ingested, ${result.summary?.processed || 0} processed`);
      console.log(`⏱️  Duration: ${duration}ms`);
      
      // Reset error count on success
      errorCount = 0;
    } else {
      throw new Error(result.error || 'Unknown pipeline error');
    }

  } catch (error) {
    errorCount++;
    const duration = Date.now() - startTime.getTime();
    
    console.error('❌ FDA fetch failed');
    console.error(`💥 Error: ${error.message}`);
    console.error(`⏱️  Duration: ${duration}ms`);
    console.error(`🔢 Error count: ${errorCount}`);

    // Log network errors differently
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Connection refused - is your Next.js server running?');
    } else if (error.name === 'FetchError') {
      console.error('🌐 Network error - check your internet connection');
    }

    // Stop cron if too many consecutive errors (optional safety measure)
    if (errorCount >= 5) {
      console.error('🛑 Too many consecutive errors, stopping cron job');
      process.exit(1);
    }

  } finally {
    isRunning = false;
    console.log(`📈 Stats: ${runCount} successful runs, ${errorCount} errors`);
  }
}

// Manual trigger function for development
async function manualTrigger() {
  console.log('\n🎯 Manual trigger requested');
  await fetchFDANews();
}

// Health check function
function healthCheck() {
  const now = new Date();
  const uptime = process.uptime();
  
  console.log('\n💊 FDA Cron Health Check');
  console.log(`⏰ Current time: ${now.toISOString()}`);
  console.log(`🕐 Uptime: ${Math.floor(uptime / 60)} minutes`);
  console.log(`📊 Successful runs: ${runCount}`);
  console.log(`❌ Error count: ${errorCount}`);
  console.log(`🔄 Last run: ${lastRun ? lastRun.toISOString() : 'Never'}`);
  console.log(`🎯 Next run: ${getNextRunTime()}`);
  console.log(`⚙️  Config: ${config.cronSchedule} (${config.enabled ? 'enabled' : 'disabled'})`);
  console.log(`🏃 Currently running: ${isRunning ? 'Yes' : 'No'}`);
}

// Get next cron run time (approximate)
function getNextRunTime() {
  const now = new Date();
  const nextRun = new Date(now);
  
  // For every 10 minutes schedule
  const currentMinutes = now.getMinutes();
  const nextMinutes = Math.ceil(currentMinutes / 10) * 10;
  
  if (nextMinutes === 60) {
    nextRun.setHours(nextRun.getHours() + 1, 0, 0, 0);
  } else {
    nextRun.setMinutes(nextMinutes, 0, 0);
  }
  
  return nextRun.toISOString();
}

// Graceful shutdown handler
function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  
  if (isRunning) {
    console.log('⏳ Waiting for current fetch to complete...');
    // Wait up to 30 seconds for current operation to complete
    const shutdownTimer = setTimeout(() => {
      console.log('⏰ Force shutdown after timeout');
      process.exit(1);
    }, 30000);
    
    const checkInterval = setInterval(() => {
      if (!isRunning) {
        clearTimeout(shutdownTimer);
        clearInterval(checkInterval);
        console.log('✅ Shutdown complete');
        process.exit(0);
      }
    }, 1000);
  } else {
    console.log('✅ Shutdown complete');
    process.exit(0);
  }
}

// Main execution
function main() {
  console.log('💊 FDA News Cron Job Starting...');
  console.log(`🎯 Target URL: ${config.baseUrl}`);
  console.log(`⏰ Schedule: ${config.cronSchedule}`);
  console.log(`📊 Fetch limit: ${config.limit}`);
  console.log(`⚙️  Enabled: ${config.enabled}`);

  // Set up signal handlers for graceful shutdown
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Schedule cron job
  if (config.enabled) {
    const task = cron.schedule(config.cronSchedule, fetchFDANews, {
      scheduled: true,
      timezone: 'America/New_York' // FDA is US-based
    });

    console.log('✅ Cron job scheduled successfully');
    
    // Optional: Run immediately on startup
    if (process.env.FDA_RUN_ON_START === 'true') {
      console.log('🚀 Running initial fetch...');
      setTimeout(fetchFDANews, 5000); // Wait 5 seconds for server to be ready
    }
  } else {
    console.log('⚠️  Cron job disabled via configuration');
  }

  // Set up health check interval (every 5 minutes)
  setInterval(healthCheck, 5 * 60 * 1000);

  // Initial health check
  setTimeout(healthCheck, 2000);

  // Keep process alive
  process.stdin.resume();
  
  // Handle manual triggers via stdin (for development)
  if (process.env.NODE_ENV === 'development') {
    console.log('\n⌨️  Development mode: Press ENTER for manual trigger, type "health" for status, "quit" to exit');
    
    process.stdin.on('data', (data) => {
      const input = data.toString().trim().toLowerCase();
      
      switch (input) {
        case '':
          manualTrigger();
          break;
        case 'health':
        case 'status':
          healthCheck();
          break;
        case 'quit':
        case 'exit':
          gracefulShutdown('USER_REQUEST');
          break;
        default:
          console.log('⚠️  Unknown command. Press ENTER to trigger, "health" for status, "quit" to exit');
      }
    });
  }
}

// Start the cron job
main();