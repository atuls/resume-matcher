import { Buffer } from 'buffer';

// Basic PDF text extraction that at least gives us some information
export async function parsePDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Try to extract text from PDF headers/metadata using regex patterns
    const pdfText = pdfBuffer.toString('utf-8', 0, Math.min(pdfBuffer.length, 100000));
    
    // Extract any readable text from the PDF
    let extractedStrings: string[] = [];
    
    // Add basic PDF metadata
    extractedStrings.push(`PDF Document Size: ${pdfBuffer.length} bytes`);
    
    // Look for text objects in the PDF
    // This is a very basic approach but it can extract some text from simpler PDFs
    const textMatches = pdfText.match(/\(\s*([^)]+?)\s*\)\s*Tj/g);
    if (textMatches && textMatches.length > 0) {
      const cleanedTexts = textMatches.map(match => {
        const content = match.substring(1, match.indexOf(')'));
        return content.replace(/\\r|\\n|\\t/g, ' ').trim();
      }).filter(text => text.length > 2);
      
      extractedStrings.push(...cleanedTexts);
    }
    
    // If no text was extracted, provide a fallback message
    if (extractedStrings.length <= 1) {
      extractedStrings.push("Unable to extract detailed text content. This may be a scanned document or the text might be stored in a format that requires more specialized tools.");
    }
    
    return extractedStrings.join('\n');
  } catch (error) {
    console.error('Error in fallback PDF parser:', error);
    return `PDF text extraction failed. Document is ${pdfBuffer.length} bytes in size.`;
  }
}