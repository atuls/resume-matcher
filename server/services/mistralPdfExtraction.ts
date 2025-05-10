import MistralClient from '@mistralai/mistralai';
import fs from 'fs/promises';
import { Buffer } from 'buffer';

// Function to check if Mistral API key is available
export function isMistralApiKeyAvailable(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

// Function to extract text from PDF using Mistral's OCR capabilities
export async function extractTextFromPDFWithMistral(buffer: Buffer): Promise<string> {
  if (!isMistralApiKeyAvailable()) {
    throw new Error('MISTRAL_API_KEY environment variable is not set');
  }

  try {
    const mistralClient = new MistralClient(process.env.MISTRAL_API_KEY as string);
    
    // Convert Buffer to base64
    const base64String = buffer.toString('base64');
    
    // Call Mistral API with the PDF content
    const response = await mistralClient.chat({
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
              type: "image",
              image_url: {
                url: `data:application/pdf;base64,${base64String}`
              }
            }
          ]
        }
      ],
      temperature: 0.0, // Use low temperature for more deterministic responses
      max_tokens: 8000, // Allow for long documents
    });
    
    // Return the extracted text
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error extracting text from PDF with Mistral:', error);
    throw new Error('Failed to extract text from PDF with Mistral API');
  }
}