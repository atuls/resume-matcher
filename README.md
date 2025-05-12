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
- **Customizable Analysis Prompts**: Configure how AI models analyze resumes via settings
- **Advanced Debugging**: Debug Info tab shows raw AI responses for troubleshooting
- **On-demand Resume Analysis**: Analyze resumes only when needed to reduce API usage
- **Performance Optimization**: Efficient handling of large candidate pools with optimized API usage

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
5. **View Matches**: Browse candidates with their match scores, sort by score to find best matches
6. **On-demand Analysis**: Click the "Analyze" button for any candidate to view their position details, highlights, and red flags
7. **Efficient Processing**: Analyze only the candidates you're interested in to reduce API usage and speed up processing
8. **View Details**: Click on a resume to see detailed candidate information and job-specific scores

## Data Flow

1. Job descriptions and resumes are uploaded and parsed
2. AI extracts structured data from unstructured text
3. Matching algorithm compares candidate skills to job requirements
4. Results are stored in database for quick retrieval 
5. Visual interface displays match scores and detailed breakdowns