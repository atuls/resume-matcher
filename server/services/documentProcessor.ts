import { Buffer } from 'buffer';
import { createRequire } from 'module';

// Import dynamically to support ESM
const importDynamic = new Function('modulePath', 'return import(modulePath)');

import { isMistralApiKeyAvailable, extractTextFromPDFWithMistral } from './mistralPdfExtraction';
import { isOpenAIApiKeyAvailable, extractTextFromPDFWithOpenAI } from './openaiPdfExtraction';
import { parsePDF } from './pdfParser';

// Function to extract text from PDF with fallback to basic extraction
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // First use our reliable basic PDF parser that doesn't rely on external libraries
    console.log('Using basic PDF text extraction...');
    
    try {
      // Use our basic PDF parser that doesn't use pdf-parse
      const extractedText = await parsePDF(buffer);
      
      if (extractedText && extractedText.trim() !== '') {
        // If we got something useful, return it
        return extractedText;
      }
      
      // If basic extraction didn't provide useful content, check if Mistral is available
      if (isMistralApiKeyAvailable()) {
        try {
          console.log('Basic extraction had limited results, trying Mistral...');
          return await extractTextFromPDFWithMistral(buffer);
        } catch (mistralError) {
          console.warn('Mistral PDF extraction failed:', mistralError);
        }
      }
      
      // If we're here, all methods failed or returned limited content
      return `PDF Document Size: ${buffer.length} bytes\n\nUnable to extract detailed text content. This may be a scanned document or the text might be stored in a format that requires more specialized tools.`;
    } catch (parserError) {
      console.error('Basic PDF parser failed:', parserError);
      // Extract basic information
      return `PDF Document Size: ${buffer.length} bytes\n\nUnable to extract detailed text content. This may be a scanned document or the text might be stored in a format that requires more specialized tools.`;
    }
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return `PDF Document Size: ${buffer.length} bytes`;
  }
}

// Function to extract text from DOCX
export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await importDynamic('mammoth').then((module: any) => module.default);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error('Failed to extract text from DOCX');
  }
}

// Function to determine file type and extract text
export async function extractTextFromFile(buffer: Buffer, fileName: string): Promise<string> {
  const fileExtension = fileName.split('.').pop()?.toLowerCase();

  switch (fileExtension) {
    case 'pdf':
      return extractTextFromPDF(buffer);
    case 'docx':
    case 'doc':
      return extractTextFromDOCX(buffer);
    case 'txt':
      return buffer.toString('utf-8');
    default:
      throw new Error(`Unsupported file format: ${fileExtension}`);
  }
}

// Parse job description text to extract title and potentially other metadata
export function parseJobDescription(text: string): { 
  title: string;
  company?: string;
  description: string; 
} {
  // Simple extraction of the first line as title
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  let title = 'Job Description';
  
  if (lines.length > 0) {
    title = lines[0].trim();
    
    // If the title is really long, truncate or use a generic title
    if (title.length > 100) {
      title = 'Job Description';
    }
  }

  return {
    title,
    description: text.trim(),
  };
}

// Parse resume to extract candidate name and title
export function parseResume(text: string): {
  candidateName?: string;
  candidateTitle?: string;
} {
  // Simple extraction of the first line as name
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  let candidateName;
  let candidateTitle;
  
  if (lines.length > 0) {
    candidateName = lines[0].trim();
    
    // If the name is too long, it's probably not a name
    if (candidateName.length > 50) {
      candidateName = undefined;
    }
    
    // Check for a potential title in the next few lines
    if (lines.length > 1) {
      for (let i = 1; i < Math.min(5, lines.length); i++) {
        const line = lines[i].trim();
        // Typical titles are relatively short
        if (line.length > 5 && line.length < 50 && 
            !line.includes('@') && !line.includes('http')) {
          candidateTitle = line;
          break;
        }
      }
    }
  }

  return {
    candidateName,
    candidateTitle
  };
}
