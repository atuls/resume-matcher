// Import types from schema
import {
  JobDescription,
  JobRequirement,
  Resume,
  AnalysisResult
} from '@shared/schema';

// Extended types for frontend use
export interface EnrichedAnalysisResult extends AnalysisResult {
  resume: {
    id: string;
    candidateName: string | null;
    candidateTitle: string | null;
    fileName: string;
    fileType: string;
  };
  analysis_warning?: string;
  extracted_text?: string;
}

export interface SkillMatch {
  requirement: string;
  match: 'full' | 'partial' | 'none'; 
  confidence: number;
  evidence?: string;
}

export type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export interface FileWithPreview extends File {
  preview?: string;
}

export interface AnalysisStatus {
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}
