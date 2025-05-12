# Changelog

All notable changes to the Resume Analyzer project will be documented in this file.

## [Unreleased]

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