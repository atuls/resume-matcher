// Use Mistral's dedicated OCR endpoint for document text extraction
import { Buffer } from 'buffer';

// Function to check if Mistral API key is available
export function isMistralApiKeyAvailable(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

// Function to extract text from PDF using Mistral's dedicated OCR endpoint
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
    
    console.log('Using Mistral OCR endpoint for PDF text extraction...');
    
    const apiKey = process.env.MISTRAL_API_KEY;
    
    // Using the specialized OCR endpoint as per documentation
    const url = 'https://api.mistral.ai/v1/ocr/process';
    
    // Use the dedicated OCR model with the proper document format
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          document_url: `data:application/pdf;base64,${base64String}`
        }
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Mistral API error response: ${errorText}`);
      throw new Error(`Mistral API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Mistral OCR API response status:', response.status);
    
    // OCR endpoint returns text directly in response
    if (!data.text) {
      console.error('Invalid OCR response format from Mistral API:', JSON.stringify(data));
      throw new Error('Missing text in OCR response from Mistral API');
    }
    
    return data.text.trim();
  } catch (error) {
    console.error('Error extracting text from PDF with Mistral:', error);
    throw new Error('Failed to extract text from PDF with Mistral API');
  }
}