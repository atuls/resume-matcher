// Use OpenAI's Vision API to extract text from PDF documents
import { Buffer } from 'buffer';

// Function to check if OpenAI API key is available
export function isOpenAIApiKeyAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// Function to extract text from PDF using OpenAI's Vision API
export async function extractTextFromPDFWithOpenAI(buffer: Buffer): Promise<string> {
  if (!isOpenAIApiKeyAvailable()) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  try {
    // Check if buffer is too large (OpenAI may have size limits)
    const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB limit
    if (buffer.length > MAX_PDF_SIZE) {
      throw new Error(`PDF is too large (${buffer.length} bytes) for OpenAI API processing`);
    }
    
    // Convert Buffer to base64
    const base64String = buffer.toString('base64');
    
    console.log('Using OpenAI Vision API for PDF text extraction...');
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    // Use the chat completions API with GPT-4 Vision
    const url = 'https://api.openai.com/v1/chat/completions';
    
    // Use gpt-4-vision-preview which handles PDFs well
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text content from this PDF document. Return only the raw text, exactly as it appears in the document. Do not include any commentary, analysis, or additional formatting instructions."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64String}`
                }
              }
            ]
          }
        ],
        temperature: 0.0,
        max_tokens: 4000,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error response: ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('OpenAI API response status:', response.status);
    
    // Extract the content from the chat completion
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response format from OpenAI API:', JSON.stringify(data));
      throw new Error('Invalid response format from OpenAI API');
    }
    
    const content = data.choices[0].message.content;
    
    if (!content) {
      throw new Error('Empty content received from OpenAI API');
    }
    
    return typeof content === 'string' ? content.trim() : JSON.stringify(content);
  } catch (error) {
    console.error('Error extracting text from PDF with OpenAI:', error);
    throw new Error('Failed to extract text from PDF with OpenAI API');
  }
}