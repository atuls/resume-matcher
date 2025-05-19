// Use CommonJS format
const { spawn } = require('child_process');

// Function to run a curl command
function runCurlCommand() {
  return new Promise((resolve, reject) => {
    const curl = spawn('curl', [
      '-X', 'POST', 
      'http://localhost:5000/api/sync-parsed-json', 
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({ limit: 100 }) // Process up to 100 records at a time
    ]);
    
    let stdout = '';
    let stderr = '';
    
    curl.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    curl.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    curl.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${stdout}`));
        }
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

// Function to check status
function checkStatus() {
  return new Promise((resolve, reject) => {
    const curl = spawn('curl', [
      '-X', 'GET', 
      'http://localhost:5000/api/sync-parsed-json/status', 
      '-H', 'Content-Type: application/json'
    ]);
    
    let stdout = '';
    let stderr = '';
    
    curl.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    curl.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    curl.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${stdout}`));
        }
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
  });
}

async function main() {
  console.log("Starting bulk sync operation...");
  
  try {
    // Get initial status
    const initialStatus = await checkStatus();
    console.log(`Initial status: ${initialStatus.status.processed}/${initialStatus.status.total} records processed (${initialStatus.status.percentComplete}%)`);
    
    let totalProcessed = 0;
    let iteration = 0;
    let processingCount = 1; // Start with non-zero to enter the loop
    
    // Continue processing until no more records are being processed
    while (processingCount > 0) {
      iteration++;
      
      // Run the sync command
      const result = await runCurlCommand();
      processingCount = result.processed;
      totalProcessed += processingCount;
      
      console.log(`Batch ${iteration}: Processed ${result.processed} records, skipped ${result.skipped}`);
      
      // Check if we should continue (if we've processed less than 10 records, we're probably near the end)
      if (processingCount < 10) {
        console.log("Fewer than 10 records processed in this batch, likely approaching completion");
        
        // Do one more check with status endpoint
        const finalStatus = await checkStatus();
        if (finalStatus.status.remaining < 10) {
          console.log("Fewer than 10 records remaining, finishing process");
          break;
        }
      }
      
      // Add a small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Get final status
    const finalStatus = await checkStatus();
    console.log(`\nSync operation completed!`);
    console.log(`Final status: ${finalStatus.status.processed}/${finalStatus.status.total} records processed (${finalStatus.status.percentComplete}%)`);
    console.log(`Total records processed in this run: ${totalProcessed}`);
    
  } catch (error) {
    console.error("Error during bulk sync:", error);
  }
}

// Run the main function
main();