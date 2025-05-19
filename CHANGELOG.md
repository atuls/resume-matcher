# Changelog

All notable changes to the Resume Analyzer project will be documented in this file.

## [Unreleased]

### Added
- Raw response processing script for efficient batch processing of analysis data
- Command-line interface for processing raw responses with options for job-specific filtering and forced reprocessing
- Improved data extraction from various response formats with comprehensive fallback mechanisms
- Job context preservation when navigating from job candidates to resume profiles
- Case-insensitive field handling for better display consistency across different data formats
- "Run on All Unanalyzed" feature for processing all unanalyzed resumes at once
- Enhanced batch processing with accurate count display and confirmation dialog
- Analysis Summary Statistics panel showing processing status metrics for all candidates
- "Load Raw Responses" button to fetch and display all resume analysis data at once
- Visual progress indicators in statistics panel showing completion percentages

### Changed
- Enhanced current position detection with multiple fallback strategies
- Improved work history extraction with better sorting and identification of current roles
- More robust JSON parsing with graceful error handling for malformed responses
- Simplified candidate display to show all resumes at once without pagination
- Increased default page size limits to accommodate large candidate pools

### Fixed
- Fixed issue with raw analysis processing API endpoint returning HTML instead of JSON
- Resolved current position and red flags not displaying in the UI for some candidates
- Fixed database query in parsed analysis endpoint to correctly filter by both resume ID and job ID
- Fixed missing company names in work history display due to case sensitivity in field names
- Resolved data discrepancy between database records and UI display
- Fixed batch processing to correctly handle and display the total number of unanalyzed resumes
- Fixed pagination issues when loading all resume analysis data (now shows all 278 results)
- Corrected API parameter naming mismatch between client and server (pageSize vs limit)

## [1.8.0] - 2025-05-15

### Added
- Batch processing capability with "Analyze Next 50 Unanalyzed" button
- Real-time progress tracking for batch analysis with WebSocket updates
- Structured database storage for analysis results with parsing status indicators
- Enhanced candidate tracking with "Mark as Contacted" functionality
- Background job processing with proper controls to prevent unintended batch executions

### Changed
- Improved performance by avoiding unnecessary API calls during page loads
- Enhanced WebSocket progress notifications with detailed status updates
- Better UI feedback during batch processing operations

### Fixed
- Fixed "Mark as Contacted" functionality by updating to use correct database field name
- Resolved issue with automatic batch processing running unintentionally
- Fixed error handling in batch processing to track successful and failed record IDs
- Eliminated redundant API calls for red flag analysis during page loads

## [1.7.0] - 2024-05-15

### Added
- Overall score display in Debug Panel for easier reference
- Enhanced response parser with support for multiple field naming formats
- Database persistence for parsed analysis fields (skills, work history, red flags)
- Improved extraction from nested JSON structures with fallback mechanisms
- Detailed console logging for tracing data extraction sources

### Changed
- All UI tabs (Skills, Work History, Red Flags) now consistently use the same data source
- Enhanced JSON structure detection with better field name handling
- Improved error handling in analysis processing

### Fixed
- Fixed data inconsistency issues between different tabs showing different content
- Resolved field extraction failures from deeply nested structures
- Fixed database update process for saving parsed analysis data
- Enhanced parser reliability with support for various field naming conventions

## [1.6.0] - 2024-05-13

### Added
- Enhanced work history extraction with multiple data source fallbacks
- Job selection dropdown in resume profile interface
- Score display with visual progress indicator in candidate profiles
- Re-run Analysis button for updating job-specific scores on demand
- Auto-selection of the first available job when viewing profiles
- Console logging for data extraction troubleshooting

### Changed
- Improved data extractors to handle various response formats
- Enhanced ResumeWorkHistoryTab to accept both analysis and redFlagData
- Optimized job score display with empty state handling
- Updated job selection UX for better user experience
- Restructured profile page for better information hierarchy

### Fixed
- Fixed work history not displaying in some resume profiles
- Resolved SelectItem empty value error in job selection dropdown
- Fixed apiRequest parameter type issues in analysis functionality
- Improved handling of null values in job selection state
- Enhanced edge case handling in data extraction utilities

## [1.5.0] - 2024-05-12

### Added
- Enhanced AI response parser with support for multiple LLM response formats
- Single-prompt analysis approach for comprehensive resume evaluation
- Automatic score normalization between different scales (0-1, 0-10, 0-100)
- Expanded pattern matching for skills and requirements extraction
- Structured extraction of sections from AI responses for UI display
- Support for snake_case, camelCase, and capitalized field names in AI responses

### Changed
- Improved Claude response parsing with more flexible field extraction
- Reorganized AI service architecture to separate concerns (LLM calls vs parsing)
- Enhanced error handling for JSON parsing with graceful fallbacks
- More detailed logging of extracted data for debugging
- Optimized data extraction from varied Claude response formats

### Fixed
- Fixed inconsistent score extraction from different LLM formats
- Resolved issues where skills weren't properly extracted from nested structures
- Fixed missing requirements extraction from alternative response formats
- Eliminated default score of 50 when actual scores are available in responses
- Improved candidate name extraction in batch processing

## [1.4.0] - 2024-05-12

### Added
- On-demand resume analysis with "Analyze" buttons to reduce API usage
- Loading indicators for analysis in progress
- Responsive table layout with horizontal scrolling
- Improved table column visibility for all screen sizes

### Changed
- Optimized API usage by avoiding automatic analysis of all resumes
- Enhanced table display with fixed column widths and better spacing
- Improved overall user experience with clear visual cues for analysis status

### Fixed
- Eliminated redundant red-flag API calls when loading resumes
- Fixed table layout issues where columns were not properly displayed
- Resolved API rate limit issues by implementing on-demand analysis
- Fixed navigation issues between different URL patterns for candidate pages

## [1.3.0] - 2024-05-11

### Added
- Multi-model AI support with OpenAI, Anthropic Claude, and Mistral
- Customizable analysis prompts via settings
- Debug Info tab showing raw AI responses
- Settings page for configuring AI model preferences
- Ability to save custom analysis prompts
- Model selection with automatic fallback mechanism

### Changed
- Enhanced raw response capture in both Claude and OpenAI services
- Improved JSON parsing with robust error handling
- Better handling of different AI model responses

### Fixed
- Debug Info tab now properly shows raw AI responses
- JSON parsing issues with non-standard Claude responses
- OpenAI service compatibility with new API requirements
- Type errors in AI service implementations

## [1.2.0] - 2024-05-10

### Added
- Match score column in candidates list
- Sortable columns including match score sorting
- Job-specific match score display in resume profile page
- Visual progress bars for match score representation
- Color-coded score badges (green for high scores, blue for medium scores)
- Job selection dropdown in resume profile to view scores across different jobs
- "Not matched" indicators for unmatched resumes
- Match quality indicators ("Great match", "Good match", "Low match")

### Changed
- Renamed "Batch Match Resumes" to "Match All with Job" for clarity
- Enhanced progress indication during batch matching
- Improved sort direction indicators in table headers

### Fixed
- Empty string issue in Select component options

## [1.1.0] - 2024-05-09

### Added
- Multiple resume upload functionality
- Batch matching capability for processing multiple resumes at once
- Filtering of candidates by job position
- Search functionality for candidate name and filename
- File size display in candidate list
- Delete resume functionality with confirmation dialog

### Changed
- Enhanced resume text extraction using combined approach with fallbacks
- Improved loading indicators for asynchronous operations

## [1.0.0] - 2024-05-08

### Added
- Initial release with basic functionality
- Job description upload and analysis
- Resume upload and parsing
- Resume-job matching algorithm
- Skill extraction from resumes
- Work history extraction from resumes
- Tabbed interface for resume details
- Match with job functionality