# Resume Analyzer

An AI-powered resume analysis platform that efficiently matches candidate resumes with job descriptions using advanced machine learning techniques.

## Features

- **Document Processing**: Extract text from PDF and DOCX resume files
- **Job Description Analysis**: Extract key requirements from job descriptions
- **Resume Analysis**: Extract skills and work history from resumes
- **Smart Matching**: Match candidate resumes against job requirements with numerical scoring
- **Multiple Resume Upload**: Support for batch uploading and processing of multiple resumes
- **Batch Matching**: Match multiple resumes with a job position simultaneously
- **Visual Progress**: Color-coded match scores with progress bars
- **Sortable Results**: Sort candidates by match score to prioritize best matches
- **Multi-model AI Support**: Choose between OpenAI GPT or Anthropic Claude for analysis
- **Batch Processing Controls**: Process unanalyzed resumes in controlled batches with progress tracking
- **Customizable Analysis Prompts**: Configure how AI models analyze resumes via settings
- **Advanced Debugging**: Debug Info tab shows raw AI responses for troubleshooting with overall score display
- **On-demand Resume Analysis**: Analyze resumes only when needed to reduce API usage
- **Performance Optimization**: Efficient handling of large candidate pools with optimized API usage
- **Analysis Summary Statistics**: View processing metrics and completion percentages for all candidates
- **Unlimited Results Display**: Show all candidate results at once without pagination limitations
- **Load Raw Responses**: Load and display all available analysis data with a single click
- **Flexible AI Response Parsing**: Robust extraction of data from various LLM response formats
- **Single-Prompt Analysis**: Unified prompt system for comprehensive resume evaluation
- **Score Normalization**: Automatic conversion of different scoring scales (0-1, 0-10, 0-100)
- **Versatile Data Extraction**: Extract work history, skills, and red flags from multiple response structures
- **Consistent Data Display**: All UI tabs show data from the same parsed source for consistency
- **Job Matching Interface**: Interactive job selection with score display in candidate profiles
- **Job Context Preservation**: Preserves job selection when navigating between pages
- **Case-Insensitive Field Handling**: Displays data correctly regardless of field name casing
- **Re-run Analysis**: Ability to re-analyze candidates against specific jobs on demand
- **Database Persistence**: Parsed analysis fields are stored in the database for reliable access
- **Raw Response Processing**: Command-line tool for batch processing of raw analysis data
- **Enhanced Current Position Detection**: Intelligent extraction of candidate's current role with multi-strategy fallback
- **Robust Error Handling**: Graceful handling of JSON parsing errors in AI responses
- **Admin Processing Interface**: API endpoint for re-processing analysis data on demand

## Tech Stack

- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Node.js/Express API
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: OpenAI/GPT, Anthropic Claude, and Mistral AI for document analysis
- **Document Processing**: PDF text extraction with fallback methods

## Environment Variables

The application requires the following environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENAI_API_KEY` | OpenAI API key for document analysis |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key for document analysis |
| `MISTRAL_API_KEY` | Mistral AI API key for PDF extraction (optional) |

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run the development server: `npm run dev`

## Usage

1. **Upload Job Descriptions**: Upload PDF or DOCX job descriptions to extract requirements
2. **Upload Resumes**: Upload one or multiple candidate resumes
3. **Match Resumes with Jobs**: Use the "Match with Job" feature to score candidates
4. **Batch Matching**: Use "Match All with Job" to process multiple resumes at once
5. **Batch Processing**: Process unanalyzed resumes either in small batches or all at once with "Run on All Unanalyzed" feature
6. **View Matches**: Browse candidates with their match scores, sort by score to find best matches
7. **On-demand Analysis**: Click the "Analyze" button for any candidate to view their position details, highlights, and red flags
8. **Efficient Processing**: Analyze only the candidates you're interested in to reduce API usage and speed up processing
9. **View Details**: Click on a resume to see detailed candidate information and job-specific scores
10. **Job-specific Matching**: Use the job selection dropdown in candidate profiles to compare match scores against different job positions
11. **Re-run Analysis**: Update match scores for specific job-candidate combinations using the Re-run Analysis button
12. **Candidate Tracking**: Mark candidates as contacted with a simple checkbox to track outreach efforts
13. **Analysis Statistics**: View processing status with the Analysis Summary panel showing completion percentages
14. **Load All Data**: Use the "Load Raw Responses" button to display all analyzed resumes for a selected job

## Data Flow

1. Job descriptions and resumes are uploaded and parsed
2. AI extracts structured data from unstructured text
3. Flexible parser handles various JSON response formats from different AI models
4. Score normalization converts different scales (0-1, 0-10, 0-100) for consistent comparison
5. Matching algorithm compares candidate skills to job requirements
6. Results are stored in database for quick retrieval
7. Visual interface displays match scores and detailed breakdowns in organized tabs
8. Additional sections (Skills, Work History, Red Flags) are extracted for comprehensive analysis