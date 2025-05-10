// Use Mistral's dedicated OCR model for document text extraction
import { Buffer } from 'buffer';

// Function to check if Mistral API key is available
export function isMistralApiKeyAvailable(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

// Function to extract text from PDF using Mistral's dedicated OCR model
export async function extractTextFromPDFWithMistral(buffer: Buffer): Promise<string> {
  if (!isMistralApiKeyAvailable()) {
    throw new Error('MISTRAL_API_KEY environment variable is not set');
  }

  try {
    // Check if buffer is too large (Mistral may have size limits)
    const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB limit
    if (buffer.length > MAX_PDF_SIZE) {
      throw new Error(`PDF is too large (${buffer.length} bytes) for Mistral API processing`);
    }
    
    // Convert Buffer to base64
    const base64String = buffer.toString('base64');
    
    console.log('Using Mistral OCR model for PDF text extraction...');
    
    const apiKey = process.env.MISTRAL_API_KEY;
    
    // Using the specialized OCR endpoint as per documentation
    const url = 'https://api.mistral.ai/v1/chat/completions';
    
    // Use the dedicated OCR model
    const modelName = "mistral-ocr-latest";
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text content from this document. Return only the raw text without any additional comments or formatting instructions."
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
      console.error(`Mistral API error response: ${errorText}`);
      throw new Error(`Mistral API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Mistral API response status:', response.status);
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response format from Mistral API:', JSON.stringify(data));
      throw new Error('Invalid response format from Mistral API');
    }
    
    // Extract and return the content
    const content = data.choices[0].message.content;
    
    if (!content) {
      throw new Error('Empty content received from Mistral API');
    }
    
    return typeof content === 'string' ? content.trim() : JSON.stringify(content);
  } catch (error) {
    console.error('Error extracting text from PDF with Mistral:', error);
    throw new Error('Failed to extract text from PDF with Mistral API');
  }
}