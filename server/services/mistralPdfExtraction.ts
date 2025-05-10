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
    // Convert Buffer to base64
    const base64String = buffer.toString('base64');
    
    // Prepare the request to Mistral API
    console.log('Using Mistral multimodal model for PDF text extraction...');
    
    const apiKey = process.env.MISTRAL_API_KEY;
    const url = 'https://api.mistral.ai/v1/chat/completions';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-large-latest", // Use the latest model that supports multimodal inputs
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please extract ALL text content from this PDF document. Return ONLY the text content, no additional comments or formatting. Keep the original structure as much as possible."
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
        max_tokens: 8000,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mistral API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid response format from Mistral API');
    }
    
    // Extract and return the content
    const content = data.choices[0].message.content;
    return typeof content === 'string' ? content.trim() : JSON.stringify(content);
  } catch (error) {
    console.error('Error extracting text from PDF with Mistral:', error);
    throw new Error('Failed to extract text from PDF with Mistral API');
  }
}