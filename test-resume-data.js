// Test script to debug resume data mismatch issue
const { pool } = require('./server/db');
const { config } = require('dotenv');

// Load environment variables
config();

async function checkResumeData() {
  console.log('Testing resume data for ID: 59b024e9-b079-4976-bd40-46e720602a3b');
  
  try {
    // Get the resume data directly from the database
    const resumeResult = await pool.query(
      'SELECT * FROM resumes WHERE id = $1',
      ['59b024e9-b079-4976-bd40-46e720602a3b']
    );
    
    if (resumeResult.rows.length === 0) {
      console.log('Resume not found');
      return;
    }
    
    const resume = resumeResult.rows[0];
    console.log('Resume found:');
    console.log('- Filename:', resume.file_name);
    console.log('- Candidate name:', resume.candidate_name);
    
    // Check extracted text for specific information
    const extractedText = resume.extracted_text;
    console.log('\nExtracted text length:', extractedText.length);
    console.log('Extract contains "Olivia DeSpirito"?', extractedText.includes('Olivia DeSpirito'));
    console.log('Extract contains "HOTWORX"?', extractedText.includes('HOTWORX'));
    
    // Show the start of the extracted text
    console.log('\nExtracted text preview (first 500 chars):');
    console.log(extractedText.substring(0, 500));
    
    // Get the most recent analysis result
    const analysisResult = await pool.query(
      'SELECT * FROM analysis_results WHERE resume_id = $1 ORDER BY created_at DESC LIMIT 1',
      ['59b024e9-b079-4976-bd40-46e720602a3b']
    );
    
    if (analysisResult.rows.length === 0) {
      console.log('\nNo analysis results found');
      return;
    }
    
    const analysis = analysisResult.rows[0];
    console.log('\nMost recent analysis:');
    console.log('- Score:', analysis.overall_score);
    console.log('- AI Model:', analysis.ai_model);
    console.log('- Created at:', analysis.created_at);
    
    // Check if raw response has the correct data
    const rawResponse = analysis.raw_response;
    if (rawResponse) {
      console.log('\nRaw response preview:');
      const rawResponseJSON = JSON.stringify(rawResponse).substring(0, 500);
      console.log(rawResponseJSON);
      
      console.log('\nRaw response contains "Olivia DeSpirito"?', 
        JSON.stringify(rawResponse).includes('Olivia DeSpirito'));
      console.log('Raw response contains "HOTWORX"?', 
        JSON.stringify(rawResponse).includes('HOTWORX'));
      
      // If the response includes a rawText field that's parsed from JSON, check that
      if (rawResponse.rawText) {
        console.log('\nRaw text from response contains "Olivia DeSpirito"?', 
          rawResponse.rawText.includes('Olivia DeSpirito'));
      }
    }
    
  } catch (error) {
    console.error('Error testing resume data:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the test
checkResumeData().catch(console.error);