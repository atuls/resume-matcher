// Use Mistral's OCR capabilities for PDF text extraction
import { Buffer } from 'buffer';
import { Mistral } from '@mistralai/mistralai';

// Function to check if Mistral API key is available
export function isMistralApiKeyAvailable(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

// Function to extract text from PDF using Mistral's OCR API
export async function extractTextFromPDFWithMistral(buffer: Buffer): Promise<string> {
  if (!isMistralApiKeyAvailable()) {
    throw new Error('MISTRAL_API_KEY environment variable is not set');
  }

  try {
    // Use the same size limit as in the working implementation
    const SIZE_LIMIT_BYTES = 1024 * 1024; // 1MB limit
    
    if (buffer.length > SIZE_LIMIT_BYTES) {
      console.log(`PDF file too large for Mistral OCR extraction (${buffer.length} bytes)`);
      throw new Error('PDF file too large for Mistral OCR extraction');
    }
    
    console.log('Using Mistral AI OCR API for PDF extraction');
    
    // Initialize Mistral client using the SDK
    const mistral = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY
    });
    
    console.log('Mistral client created successfully');
    console.log(`Sending PDF (${buffer.length} bytes) to Mistral OCR API...`);
    
    // Convert buffer to Base64
    const base64Data = buffer.toString('base64');
    console.log(`PDF converted to base64 (length: ${base64Data.length})`);
    
    // Create a data URI for the PDF to be used in the API call
    const pdfDataUri = `data:application/pdf;base64,${base64Data}`;
    
    // Create a promise that will reject after 3 minutes
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Mistral OCR API request timed out after 3 minutes')), 180000);
    });
    
    try {
      // Make the OCR request using the ocr.process method
      const ocrRequestPromise = mistral.ocr.process({
        model: 'mistral-ocr-latest',
        document: {
          type: "document_url",
          documentUrl: pdfDataUri
        }
      });
      
      // Race between our OCR request and the timeout
      const ocrResponse = await Promise.race([ocrRequestPromise, timeoutPromise]);
      
      console.log(`Mistral OCR API responded with pages: ${ocrResponse?.pages?.length || 0}`);
      
      // Process OCR response - combine markdown content from all pages
      if (ocrResponse && ocrResponse.pages && Array.isArray(ocrResponse.pages)) {
        let extractedText = '';
        
        // Combine text from all pages and their markdown
        for (const page of ocrResponse.pages) {
          if (page.markdown) {
            extractedText += page.markdown + '\n\n';
          }
        }
        
        console.log(`Mistral OCR successfully extracted ${extractedText.length} characters from ${ocrResponse.pages.length} pages`);
        
        return extractedText;
      } else {
        console.log('Unexpected OCR response format:', JSON.stringify(ocrResponse, null, 2));
        throw new Error('Mistral OCR API returned an unexpected response format');
      }
    } catch (timeoutError: any) {
      console.log('OCR request timed out or failed:', timeoutError.message);
      throw timeoutError;
    }
  } catch (error: any) {
    console.error('Mistral OCR extraction failed:', error);
    throw new Error(`Mistral OCR extraction failed: ${error.message}`);
  }
}