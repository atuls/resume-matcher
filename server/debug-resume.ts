// Script to debug resume data issues
import { db } from './db';
import { resumes, analysisResults } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { analyzeResumeWithClaude } from './services/anthropicService';

async function checkResumeData() {
  console.log('Testing resume data for ID: 59b024e9-b079-4976-bd40-46e720602a3b');
  
  try {
    // Get the resume data from the database using Drizzle
    const resumeData = await db.select().from(resumes).where(
      eq(resumes.id, '59b024e9-b079-4976-bd40-46e720602a3b')
    );
    
    if (resumeData.length === 0) {
      console.log('Resume not found');
      return;
    }
    
    const resume = resumeData[0];
    console.log('Resume found:');
    console.log('- Filename:', resume.fileName);
    console.log('- Candidate name:', resume.candidateName);
    
    // Check extracted text for specific information
    const extractedText = resume.extractedText;
    console.log('\nExtracted text length:', extractedText.length);
    console.log('Extract contains "Olivia DeSpirito"?', extractedText.includes('Olivia DeSpirito'));
    console.log('Extract contains "HOTWORX"?', extractedText.includes('HOTWORX'));
    
    // Show the start of the extracted text
    console.log('\nExtracted text preview (first 500 chars):');
    console.log(extractedText.substring(0, 500));
    
    // Get the most recent analysis result
    const analysisData = await db.select().from(analysisResults).where(
      eq(analysisResults.resumeId, '59b024e9-b079-4976-bd40-46e720602a3b')
    ).orderBy(analysisResults.createdAt).limit(1);
    
    if (analysisData.length === 0) {
      console.log('\nNo analysis results found');
    } else {
      const analysis = analysisData[0];
      console.log('\nMost recent analysis:');
      console.log('- Score:', analysis.overallScore);
      console.log('- AI Model:', analysis.aiModel);
      console.log('- Created at:', analysis.createdAt);
      
      // Check if raw response has the correct data
      const rawResponse = analysis.rawResponse;
      if (rawResponse) {
        console.log('\nRaw response contains "Olivia DeSpirito"?', 
          JSON.stringify(rawResponse).includes('Olivia DeSpirito'));
        console.log('Raw response contains "HOTWORX"?', 
          JSON.stringify(rawResponse).includes('HOTWORX'));
      }
    }
    
    // Test direct Claude analysis
    console.log('\n\n========= TESTING DIRECT CLAUDE ANALYSIS =========');
    console.log('Sending resume text directly to Claude for analysis...');
    
    // Use a simple job description for testing
    const testJobDescription = "We're looking for a Sales Associate with experience in customer service and retail.";
    
    try {
      const claudeResult = await analyzeResumeWithClaude(
        extractedText,
        testJobDescription
      );
      
      console.log('\nClaude analysis complete!');
      console.log('- Score:', claudeResult.score);
      console.log('- Skills count:', claudeResult.skills.length);
      
      // Check if raw response has the correct data
      if (claudeResult.rawResponse) {
        console.log('\nRaw Claude response contains "Olivia DeSpirito"?', 
          JSON.stringify(claudeResult.rawResponse).includes('Olivia DeSpirito'));
        console.log('Raw Claude response contains "HOTWORX"?', 
          JSON.stringify(claudeResult.rawResponse).includes('HOTWORX'));
        
        // Log beginning of raw response
        console.log('\nRaw Claude response preview (first 300 chars):');
        console.log(JSON.stringify(claudeResult.rawResponse).substring(0, 300));
      }
    } catch (error) {
      console.error('Error with direct Claude analysis:', error);
    }
    
  } catch (error) {
    console.error('Error testing resume data:', error);
  }
}

// Run the test
checkResumeData().catch(console.error).finally(() => {
  console.log('\nDebug script complete.');
  process.exit(0);
});