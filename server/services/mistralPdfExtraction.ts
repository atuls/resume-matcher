// We'll use the Mistral API directly with fetch instead of the SDK to avoid typing issues
import { Buffer } from 'buffer';

// Function to check if Mistral API key is available
export function isMistralApiKeyAvailable(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

// Function to extract text from PDF using Mistral's multimodal capabilities
export async function extractTextFromPDFWithMistral(buffer: Buffer): Promise<string> {
  if (!isMistralApiKeyAvailable()) {
    throw new Error('MISTRAL_API_KEY environment variable is not set');
  }

  try {
    // Check if buffer is too large (Mistral may have size limits)
    const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB limit
    if (buffer.length > MAX_PDF_SIZE) {
      throw new Error(`PDF is too large (${buffer.length} bytes) for Mistral API processing`);
    }
    
    // Convert Buffer to base64
    const base64String = buffer.toString('base64');
    
    // Prepare the request to Mistral API
    console.log('Using Mistral multimodal model for PDF text extraction...');
    
    const apiKey = process.env.MISTRAL_API_KEY;
    const url = 'https://api.mistral.ai/v1/chat/completions';
    
    // Create a proper model name - we'll use a model known to exist
    const modelName = "mistral-medium"; // More reliable than "mistral-large-latest"
    
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
                text: "Extract all text from this PDF document. Return only the text, no additional comments."
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
        max_tokens: 4000, // Reduced to avoid potential token limits
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Mistral API error response: ${errorText}`);
      throw new Error(`Mistral API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Mistral API response status:', response.status);
    console.log('Mistral API response shape:', Object.keys(data));
    
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