import { Mistral } from '@mistralai/mistralai';

/**
 * Service for extracting text from PDFs using Mistral AI's OCR capabilities
 * This leverages Mistral's dedicated OCR API for more accurate text extraction
 * compared to the chat completion API
 */
export class MistralPdfExtractor {
  // Use the latest available Mistral OCR model
  private static OCR_MODEL = 'mistral-ocr-latest';
  // Limit files to 1MB for Mistral OCR to prevent timeouts
  private static SIZE_LIMIT_BYTES = 1024 * 1024;

  /**
   * Extracts text from a PDF buffer using Mistral AI's OCR API
   * 
   * @param pdfBuffer The buffer containing PDF data
   * @returns A string with the extracted text
   */
  static async extractText(pdfBuffer: Buffer): Promise<string> {
    if (!process.env.MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY is required for Mistral PDF extraction');
    }

    try {
      console.log('Using Mistral AI OCR API for PDF extraction');
      
      // Initialize Mistral client using the SDK
      const mistral = new Mistral({
        apiKey: process.env.MISTRAL_API_KEY
      });
      
      console.log('Mistral client created successfully');
      console.log(`Sending PDF (${pdfBuffer.length} bytes) to Mistral OCR API...`);

      // Check file size - directly fall back to pdf-parse for files that are too large
      if (pdfBuffer.length > this.SIZE_LIMIT_BYTES) {
        console.log(`PDF file too large for Mistral OCR extraction (${pdfBuffer.length} bytes)`);
        throw new Error('PDF file too large for Mistral OCR extraction - falling back to pdf-parse');
      }

      // Convert buffer to Base64
      const base64Data = pdfBuffer.toString('base64');
      console.log(`PDF converted to base64 (length: ${base64Data.length})`);

      // Create a promise that will reject after 3 minutes
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Mistral OCR API request timed out after 3 minutes')), 180000);
      });
      
      // Create a data URI for the PDF to be used in the API call
      const pdfDataUri = `data:application/pdf;base64,${base64Data}`;

      try {
        // Make the OCR request using the ocr.process method
        const ocrRequestPromise = mistral.ocr.process({
          model: this.OCR_MODEL,
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
}