import { AnalysisResult } from '@shared/schema';

// Extended Analysis Result with verification info
export interface VerifiedAnalysisResult extends AnalysisResult {
  analysis_warning?: string;
  extracted_text?: string;
}