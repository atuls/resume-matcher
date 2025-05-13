// Test script to trace which prompts are used in single resume analysis
import fetch from 'node-fetch';

// Configuration
const resumeId = '5ac9ccc5-71da-45ae-8631-497170bc8d65'; // Example resume ID
const jobDescriptionId = 'f17e9b1c-9e63-4ed5-9cae-a307b37c95ff'; // Example job ID

async function logAllSettings() {
  console.log('Fetching all analysis-related settings...');
  
  const settingsToCheck = [
    'analysis_prompt',
    'work_history_prompt',
    'skills_prompt',
    'red_flags_prompt',
    'analysis_default_model',
    'analysis_include_evidence',
    'analysis_score_threshold'
  ];
  
  for (const key of settingsToCheck) {
    try {
      const response = await fetch(`http://localhost:5000/api/settings/${key}`);
      const data = await response.json();
      console.log(`Setting: ${key}`);
      console.log(`Value: ${data.value.substring(0, 100)}...`); // Show first 100 chars
      console.log('-'.repeat(80));
    } catch (error) {
      console.error(`Error fetching setting ${key}:`, error.message);
    }
  }
}

async function traceAnalysisProcess() {
  console.log(`Tracing analysis for resume ${resumeId} with job ${jobDescriptionId}`);
  
  try {
    // Add a forceRerun parameter to ensure we're not getting cached results
    const url = `http://localhost:5000/api/resumes/${resumeId}/analysis?jobDescriptionId=${jobDescriptionId}&forceRerun=true&trace=true`;
    
    console.log('Sending analysis request...');
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('\nAnalysis Results:');
    console.log(`AI Model Used: ${data.aiModel || 'Unknown'}`);
    console.log(`Score: ${data.analysis.score}%`);
    console.log(`Matched Requirements: ${data.analysis.matchedRequirements?.length || 0}`);
    
    // Check if we have raw API response data (this might include prompt info)
    if (data.rawResponse) {
      console.log('\nRaw API Response Included:');
      
      if (typeof data.rawResponse === 'string') {
        console.log('Response is a string, first 200 chars:');
        console.log(data.rawResponse.substring(0, 200) + '...');
      } else {
        console.log('Response structure:');
        console.log(JSON.stringify(Object.keys(data.rawResponse), null, 2));
        
        // Look for prompt information
        if (data.rawResponse.prompt) {
          console.log('\nPrompt Used:');
          console.log(data.rawResponse.prompt.substring(0, 200) + '...');
        }
      }
    } else {
      console.log('\nNo raw API response included in results.');
    }
    
    // Now let's also check the red flag analysis to see what prompts it uses
    console.log('\nChecking red flag analysis...');
    const redFlagUrl = `http://localhost:5000/api/resumes/${resumeId}/red-flag-analysis?jobDescriptionId=${jobDescriptionId}&trace=true`;
    const redFlagResponse = await fetch(redFlagUrl);
    
    if (!redFlagResponse.ok) {
      throw new Error(`Red flag API responded with ${redFlagResponse.status}: ${redFlagResponse.statusText}`);
    }
    
    const redFlagData = await redFlagResponse.json();
    console.log('Red flag analysis completed. Results:');
    console.log(`Current Position: ${redFlagData.analysis.currentJobPosition || 'N/A'}`);
    console.log(`Company: ${redFlagData.analysis.currentCompany || 'N/A'}`);
    console.log(`Red Flags: ${redFlagData.analysis.redFlags?.length || 0}`);
    console.log(`Highlights: ${redFlagData.analysis.highlights?.length || 0}`);
    
  } catch (error) {
    console.error('Error during analysis trace:', error);
  }
}

async function traceBatchAnalysisProcess() {
  console.log(`Tracing BATCH analysis for resume ${resumeId} with job ${jobDescriptionId}`);
  
  try {
    // First, let's check if there's any existing analysis to log as baseline
    console.log('Checking if resume already has analysis before batch process...');
    const preCheckUrl = `http://localhost:5000/api/resumes/${resumeId}/analysis?jobDescriptionId=${jobDescriptionId}`;
    try {
      const preCheckResponse = await fetch(preCheckUrl);
      if (preCheckResponse.ok) {
        const preData = await preCheckResponse.json();
        console.log('Existing analysis found:');
        console.log(`Score: ${preData.analysis?.score || 'N/A'}`);
        console.log(`Last updated: ${preData.updatedAt || 'N/A'}`);
      } else {
        console.log('No existing analysis found or error retrieving it.');
      }
    } catch (e) {
      console.log('Error checking existing analysis:', e.message);
    }
    
    // Use the batch analysis endpoint with a single resume
    const url = `http://localhost:5000/api/analyze`;
    
    const payload = {
      jobDescriptionId: jobDescriptionId,
      resumeIds: [resumeId]
    };
    
    console.log('\nSending batch analysis request...');
    console.log(`Payload: ${JSON.stringify(payload)}`);
    
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`API responded with ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('\nBatch Analysis Initial Response (received in ${Date.now() - startTime}ms):');
    console.log(JSON.stringify(data, null, 2));
    
    // Monitor the process by checking every 5 seconds for 30 seconds
    console.log('\nMonitoring batch analysis process for 30 seconds...');
    for (let i = 1; i <= 6; i++) {
      // Wait 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check for updated analysis
      console.log(`\nCheck #${i} (after ${i*5} seconds):`);
      try {
        const checkUrl = `http://localhost:5000/api/resumes/${resumeId}/analysis?jobDescriptionId=${jobDescriptionId}`;
        const checkResponse = await fetch(checkUrl);
        
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          const timestamp = new Date(checkData.updatedAt).toISOString();
          console.log(`Analysis found, updated at: ${timestamp}`);
          console.log(`Score: ${checkData.analysis?.score || 'N/A'}`);
          console.log(`AI Model: ${checkData.aiModel || 'N/A'}`);
          
          // If this appears to be a freshly processed result, print more details
          if (Date.now() - new Date(checkData.updatedAt).getTime() < 30000) {
            console.log('This appears to be a fresh result from the batch process!');
            if (checkData.analysis?.matchedRequirements) {
              console.log(`Matched ${checkData.analysis.matchedRequirements.length} requirements`);
            }
          }
        } else {
          console.log(`No analysis found yet (status: ${checkResponse.status})`);
        }
      } catch (e) {
        console.log(`Error checking status: ${e.message}`);
      }
    }
    
    // Make final check of the analysis result
    console.log('\nFinal check of analysis result:');
    const analysisUrl = `http://localhost:5000/api/resumes/${resumeId}/analysis?jobDescriptionId=${jobDescriptionId}`;
    const analysisResponse = await fetch(analysisUrl);
    
    if (!analysisResponse.ok) {
      throw new Error(`Analysis API responded with ${analysisResponse.status}: ${analysisResponse.statusText}`);
    }
    
    const analysisData = await analysisResponse.json();
    console.log('\nBatch Analysis Results:');
    console.log(`AI Model Used: ${analysisData.aiModel || 'Unknown'}`);
    console.log(`Score: ${analysisData.analysis.score}%`);
    console.log(`Matched Requirements: ${analysisData.analysis.matchedRequirements?.length || 0}`);
    console.log(`Updated At: ${new Date(analysisData.updatedAt).toISOString()}`);
    
    // Also check the red flags to ensure they were analyzed
    const redFlagUrl = `http://localhost:5000/api/resumes/${resumeId}/red-flag-analysis?jobDescriptionId=${jobDescriptionId}`;
    const redFlagResponse = await fetch(redFlagUrl);
    
    if (!redFlagResponse.ok) {
      throw new Error(`Red flag API responded with ${redFlagResponse.status}: ${redFlagResponse.statusText}`);
    }
    
    const redFlagData = await redFlagResponse.json();
    console.log('\nBatch Red Flag Analysis Results:');
    console.log(`Current Position: ${redFlagData.analysis.currentJobPosition || 'N/A'}`);
    console.log(`Company: ${redFlagData.analysis.currentCompany || 'N/A'}`);
    console.log(`Red Flags: ${redFlagData.analysis.redFlags?.length || 0}`);
    console.log(`Highlights: ${redFlagData.analysis.highlights?.length || 0}`);
    
  } catch (error) {
    console.error('Error during batch analysis trace:', error);
  }
}

async function compareAnalysisResults() {
  console.log('\nComparing individual and batch analysis results...');
  
  try {
    // Get individual analysis result
    const indivUrl = `http://localhost:5000/api/resumes/${resumeId}/analysis?jobDescriptionId=${jobDescriptionId}`;
    const indivResponse = await fetch(indivUrl);
    
    if (!indivResponse.ok) {
      throw new Error(`Individual analysis API responded with ${indivResponse.status}: ${indivResponse.statusText}`);
    }
    
    const indivData = await indivResponse.json();
    
    // Get batch analysis result (assuming it was already run by traceBatchAnalysisProcess)
    const batchUrl = `http://localhost:5000/api/resumes/${resumeId}/analysis?jobDescriptionId=${jobDescriptionId}`;
    const batchResponse = await fetch(batchUrl);
    
    if (!batchResponse.ok) {
      throw new Error(`Batch analysis API responded with ${batchResponse.status}: ${batchResponse.statusText}`);
    }
    
    const batchData = await batchResponse.json();
    
    // Compare the key parts of the analysis
    console.log('\nComparison:');
    console.log(`Individual Analysis Score: ${indivData.analysis.score}%`);
    console.log(`Batch Analysis Score: ${batchData.analysis.score}%`);
    console.log(`Individual Matched Requirements: ${indivData.analysis.matchedRequirements?.length || 0}`);
    console.log(`Batch Matched Requirements: ${batchData.analysis.matchedRequirements?.length || 0}`);
    console.log(`Score Difference: ${Math.abs(indivData.analysis.score - batchData.analysis.score)}%`);
    
    console.log('\nStructure Comparison:');
    console.log('Individual Analysis Keys:', Object.keys(indivData.analysis));
    console.log('Batch Analysis Keys:', Object.keys(batchData.analysis));
    
    // Check if the same model was used
    console.log(`\nIndividual Analysis Model: ${indivData.aiModel || 'Unknown'}`);
    console.log(`Batch Analysis Model: ${batchData.aiModel || 'Unknown'}`);
    
  } catch (error) {
    console.error('Error comparing analysis results:', error);
  }
}

// Run the tests
async function runTests() {
  console.log('='.repeat(80));
  console.log('BATCH ANALYSIS TEST');
  console.log('='.repeat(80));
  
  await logAllSettings();
  console.log('\n');
  
  // Only run batch test for now since it's time-intensive
  console.log('='.repeat(40));
  console.log('TEST: BATCH ANALYSIS PROCESS (SINGLE RESUME)');
  console.log('='.repeat(40));
  await traceBatchAnalysisProcess();
  
  console.log('\nTest completed.');
}

runTests().catch(console.error);