// Small script to check the resume API response format
import fetch from 'node-fetch';

async function checkResumeAPI() {
  const resumeId = 'c99a57c6-7071-44f7-9243-83a52449382c';
  
  try {
    const response = await fetch(`http://localhost:3000/api/resumes/${resumeId}`);
    
    if (!response.ok) {
      console.error(`API request failed with status: ${response.status}`);
      return;
    }
    
    const data = await response.json();
    
    // Log the structure of the response
    console.log('API Response Structure:');
    console.log(JSON.stringify({
      // Show top-level keys
      responseKeys: Object.keys(data),
      // Check if resume object exists and show its keys
      resumeKeys: data.resume ? Object.keys(data.resume) : 'No resume object',
      // Show specific fields we're interested in
      createdAt: data.resume?.createdAt,
      fileName: data.resume?.fileName,
      fileSize: data.resume?.fileSize,
      candidateName: data.resume?.candidateName,
      // Check if extractedText exists and show a snippet
      hasExtractedText: !!data.resume?.extractedText,
      extractedTextSample: data.resume?.extractedText 
        ? data.resume.extractedText.substring(0, 100) + '...' 
        : 'No extracted text'
    }, null, 2));
    
  } catch (error) {
    console.error('Error checking resume API:', error);
  }
}

checkResumeAPI();