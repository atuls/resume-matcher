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

// Run the tests
async function runTests() {
  console.log('='.repeat(80));
  console.log('RESUME ANALYSIS TRACING TEST');
  console.log('='.repeat(80));
  
  await logAllSettings();
  console.log('\n');
  await traceAnalysisProcess();
  
  console.log('\nTest completed.');
}

runTests().catch(console.error);