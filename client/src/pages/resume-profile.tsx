import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getResume, getResumeAnalysis, getJobDescriptions, getResumeScores, updateResumeContactedStatus, getResumeRedFlagAnalysis } from "@/lib/api";
import { 
  User, FileText, Calendar, ArrowLeft, Mail, MapPin, Phone, Award, 
  Briefcase, Code, AlertCircle, BarChart3, CheckCircle, XCircle,
  RefreshCw, UserCheck, Sparkles, AlertTriangle, Loader2, Download, FileSearch,
  ArrowUpRight, Zap
} from "lucide-react";
import { DebugPanel } from "@/components/DebugPanel";
import { ResumeSkillsTab } from "@/components/ResumeSkillsTab";
import { ResumeWorkHistoryTab } from "@/components/ResumeWorkHistoryTab";
import { TestParserBtn } from "@/components/TestParserBtn";
import { parseRawResponse, ParsedRawResponse } from "@/lib/raw-response-parser";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { formatDistance } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function ResumeProfilePage() {
  const [, params] = useRoute<{ id: string }>("/resume/:id");
  const resumeId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for loading states
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [redFlagLoading, setRedFlagLoading] = useState(false);
  const [isContactingCandidate, setIsContactingCandidate] = useState(false);
  const [jobScoreLoading, setJobScoreLoading] = useState(false);
  
  // Centralized parsed data state
  const [parsedAnalysisData, setParsedAnalysisData] = useState<ParsedRawResponse | null>(null);
  const [parsingSource, setParsingSource] = useState<string>("none");
  
  // Resume query
  const { data: resume, error: resumeError, isLoading: resumeLoading } = useQuery({
    queryKey: [`/api/resumes/${resumeId}`],
    queryFn: () => getResume(resumeId!),
    enabled: !!resumeId,
  });

  // Analysis query
  const { 
    data: analysis, 
    error: analysisError, 
    isLoading: isAnalysisLoading 
  } = useQuery({
    queryKey: [`/api/resumes/${resumeId}/analysis`],
    queryFn: () => getResumeAnalysis(resumeId!),
    enabled: !!resumeId,
  });
  
  // Red flag analysis query
  const { 
    data: redFlagData, 
    error: redFlagError, 
    isLoading: isRedFlagLoading 
  } = useQuery({
    queryKey: [`/api/resumes/${resumeId}/red-flag-analysis`],
    queryFn: () => getResumeRedFlagAnalysis(resumeId!),
    enabled: !!resumeId,
  });
  
  // Get job descriptions for the dropdown
  const { data: jobDescriptions } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: () => getJobDescriptions(),
  });
  
  // State for selected job
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  
  // Job scores query - specifically for the selected job
  // Type definition for score data
  type ScoreData = Record<string, { score: number, matchedAt: Date }>;
  
  const { 
    data: jobScore,
    refetch: refetchJobScore,
    isLoading: jobScoreIsLoading
  } = useQuery<ScoreData>({
    queryKey: [`/api/resume/${resumeId}/job-score/${selectedJobId}`],
    queryFn: () => selectedJobId ? getResumeScores(resumeId!, selectedJobId) : Promise.resolve({}),
    enabled: !!resumeId && !!selectedJobId,
  });
  
  // General scores query - for all jobs
  const { data: resumeScore } = useQuery({
    queryKey: [`/api/resumes/${resumeId}/job-connections`],
    queryFn: () => getResumeScores(resumeId!),
    enabled: !!resumeId,
  });
  
  // Set the first available job as selected when data loads
  useEffect(() => {
    if (jobDescriptions && jobDescriptions.length > 0 && selectedJobId === null) {
      // Get the first job description with a score for this resume if available
      if (resumeScore && Object.keys(resumeScore).length > 0) {
        // Find a matching job ID that exists in both resumeScore and jobDescriptions
        const matchingJobId = Object.keys(resumeScore).find(jobId => 
          jobDescriptions.some(job => job.id === jobId)
        );
        
        if (matchingJobId) {
          setSelectedJobId(matchingJobId);
          return;
        }
      }
      
      // Otherwise, just set the first job as selected
      setSelectedJobId(jobDescriptions[0].id);
    }
  }, [jobDescriptions, resumeScore, selectedJobId]);
  
  // Function to run analysis for a specific job
  const runJobAnalysis = async () => {
    if (!selectedJobId || !resumeId) {
      toast({
        title: "Please select a job",
        description: "Select a job to analyze resume against",
        variant: "destructive"
      });
      return;
    }
    
    setJobScoreLoading(true);
    
    try {
      console.log(`Running fresh job analysis for resume ${resumeId} against job ${selectedJobId} with custom prompt`);
      
      // Use the analyze endpoint to generate a score WITH force=true to ensure custom prompt is used
      const response = await fetch(`/api/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          jobDescriptionId: selectedJobId,
          resumeIds: [resumeId],
          force: true // Force a fresh analysis with custom prompt
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error analyzing resume: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log("Analysis result:", result);
      
      // Refetch the score
      await refetchJobScore();
      
      // Also invalidate resume analysis data to ensure consistency
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/analysis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/red-flag-analysis`] });
      
      toast({
        title: "Analysis complete with custom prompt",
        description: "Resume has been analyzed against the selected job using the custom prompt from settings.",
      });
    } catch (error: any) {
      console.error("Job analysis error:", error);
      toast({
        title: "Error analyzing resume",
        description: error.message || "An error occurred",
        variant: "destructive"
      });
    } finally {
      setJobScoreLoading(false);
    }
  };

  // Function to handle contacting a candidate
  const handleContactCandidate = async () => {
    if (!resumeId) return;
    
    setIsContactingCandidate(true);
    
    try {
      await updateResumeContactedStatus(resumeId, true);
      
      toast({
        title: "Success",
        description: "Candidate has been marked as contacted.",
      });
      
      // Refresh the resume data
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}`] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark candidate as contacted",
        variant: "destructive",
      });
    } finally {
      setIsContactingCandidate(false);
    }
  };

  // Handle loading and error states
  if (resumeLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (resumeError) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load resume. Please try again later.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/candidates">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to All Candidates
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Resume not found
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/candidates">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to All Candidates
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Date formatting
  const formatDate = (dateString: string | Date) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date);
    } catch (e) {
      return 'Invalid date';
    }
  };
  
  // Run skills analysis function
  const runSkillsAnalysis = async () => {
    if (!resumeId) return;
    
    setAnalysisLoading(true);
    
    try {
      // First, if there's a selected job, run a fresh job analysis using the /api/analyze endpoint
      // This handles job-specific requirements and uses the custom prompt
      if (selectedJobId) {
        console.log(`Running fresh analysis for resume ${resumeId} against job ${selectedJobId} with custom prompt`);
        
        // Use fetch directly with the analyze endpoint
        const analyzeResponse = await fetch(`/api/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            resumeIds: [resumeId],
            jobDescriptionId: selectedJobId,
            force: true
          })
        });
        
        if (!analyzeResponse.ok) {
          throw new Error(`Analysis failed with status: ${analyzeResponse.status} ${analyzeResponse.statusText}`);
        }
      } else {
        // If no job is selected, use the dedicated resume analysis endpoint
        console.log(`Running general resume analysis for ${resumeId}`);
        
        // Force a fresh analysis with forceRerun parameter
        const analysisResponse = await fetch(`/api/resumes/${resumeId}/analysis?forceRerun=true`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include"
        });
        
        if (!analysisResponse.ok) {
          throw new Error(`Analysis failed with status: ${analysisResponse.status} ${analysisResponse.statusText}`);
        }
      }
      
      // Invalidate all related data sources to ensure consistency
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/analysis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}/red-flag-analysis`] });
      
      // Also refresh scores if a job is selected
      if (selectedJobId) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/resume/${resumeId}/job-score/${selectedJobId}`] 
        });
      }
      
      // Refresh general job connections
      queryClient.invalidateQueries({ 
        queryKey: [`/api/resumes/${resumeId}/job-connections`] 
      });
      
      toast({
        title: "Analysis complete with custom prompt",
        description: "Resume data has been refreshed with updated analysis using the custom prompt from settings.",
      });
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Analysis failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button variant="outline" size="icon" asChild className="mr-4">
            <Link href="/candidates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {resume.candidateName || "Unnamed Candidate"}
          </h1>
          {resume.candidateTitle && (
            <Badge className="ml-2" variant="secondary">{resume.candidateTitle}</Badge>
          )}
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex items-center"
            disabled={isContactingCandidate || resume.contactedInRippling}
            onClick={handleContactCandidate}
          >
            {resume.contactedInRippling ? (
              <>
                <UserCheck className="mr-2 h-4 w-4 text-green-500" />
                Contacted
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Mark as Contacted
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column - Resume details */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5 text-primary" />
                Resume Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {resume.candidateName && (
                <div className="flex items-start">
                  <User className="mr-3 h-5 w-5 text-gray-500 mt-0.5" />
                  <div>
                    <div className="font-medium">{resume.candidateName}</div>
                    {resume.candidateTitle && (
                      <div className="text-sm text-gray-500">{resume.candidateTitle}</div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex items-center">
                <Calendar className="mr-3 h-5 w-5 text-gray-500" />
                <div>
                  <div className="text-sm text-gray-500">Uploaded</div>
                  <div>{formatDate(resume.createdAt)}</div>
                </div>
              </div>
              
              <div className="flex items-start">
                <FileText className="mr-3 h-5 w-5 text-gray-500 mt-0.5" />
                <div>
                  <div className="text-sm text-gray-500">File</div>
                  <div className="flex items-center gap-2">
                    <a 
                      href={`/api/resumes/${resumeId}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-blue-600 hover:text-blue-800 font-medium group bg-blue-50 hover:bg-blue-100 rounded-md px-3 py-1.5 transition-all duration-200 border border-blue-200 hover:border-blue-300"
                      onClick={(e) => {
                        e.preventDefault();
                        const downloadUrl = `/api/resumes/${resumeId}/download`;
                        window.open(downloadUrl, '_blank');
                        
                        toast({
                          title: "Opening resume",
                          description: "Resume file opened in a new tab"
                        });
                      }}
                    >
                      <FileText className="mr-1.5 h-5 w-5 text-red-500" />
                      <span className="font-medium mr-1.5">View PDF</span>
                      <span className="max-w-[150px] truncate text-blue-700">{resume.fileName}</span>
                      <ArrowUpRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-9 px-3 text-sm bg-green-50 hover:bg-green-100 text-green-700 hover:text-green-800 border-green-200 hover:border-green-300 flex items-center"
                      onClick={() => {
                        const downloadUrl = `/api/resumes/${resumeId}/download`;
                        // This will trigger a file download rather than opening in a new tab
                        const a = document.createElement('a');
                        a.href = downloadUrl;
                        a.download = resume.fileName || 'resume.pdf';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        
                        toast({
                          title: "Downloading resume",
                          description: "Resume file is being downloaded"
                        });
                      }}
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      Download PDF
                    </Button>
                  </div>
                  <div className="text-sm text-gray-500">
                    {(resume.fileSize / 1024).toFixed(2)} KB - {resume.fileType}
                  </div>
                </div>
              </div>
              
              <Separator />
              
              {/* Job selection dropdown and analysis */}
              <div className="mb-4">
                <h3 className="font-medium mb-2">Job Matching</h3>
                
                <div className="space-y-3">
                  <Select 
                    value={selectedJobId || "none"} 
                    onValueChange={(value) => setSelectedJobId(value !== "none" ? value : null)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select job position to match" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a job...</SelectItem>
                      {jobDescriptions?.map(job => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedJobId && jobScore && resumeId && jobScore[resumeId] && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Match Score:</span>
                        <span className="text-base font-semibold">
                          {`${Math.round(jobScore[resumeId]?.score || 0)}%`}
                        </span>
                      </div>
                      <div className="mt-1">
                        <Progress 
                          value={jobScore[resumeId]?.score || 0} 
                          className="h-2" 
                        />
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Analyzed: {jobScore[resumeId]?.matchedAt ? new Date(jobScore[resumeId]?.matchedAt).toLocaleString() : 'N/A'}
                      </div>
                    </div>
                  )}
                  
                  <Button 
                    onClick={runJobAnalysis} 
                    size="sm" 
                    variant="secondary" 
                    disabled={!selectedJobId || jobScoreLoading}
                    className="w-full"
                  >
                    {jobScoreLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Re-run Analysis
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Historical matched jobs */}
              {resumeScore && Object.keys(resumeScore).length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Previous Matches</h3>
                  <div className="space-y-2">
                    {Object.entries(resumeScore).map(([jobId, scoreData]) => (
                      <div key={jobId} className="p-3 bg-gray-50 rounded-md">
                        <div className="flex justify-between items-center">
                          <div className="font-medium">{"Job Match"}</div>
                          <Badge className={typeof scoreData.score === 'number' && scoreData.score >= 70 ? "bg-green-500" : "bg-amber-500"}>
                            {typeof scoreData.score === 'number' ? scoreData.score : 0}%
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          Matched {formatDistance(new Date(scoreData.matchedAt), new Date(), { addSuffix: true })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
        {/* Right column - Analysis tabs */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-primary" />
                Resume Analysis
              </CardTitle>
              <CardDescription>
                AI-powered analysis of the candidate's resume
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Tabs defaultValue="skills" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="skills">
                    <Code className="h-4 w-4 mr-2" />
                    Skills
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <Briefcase className="h-4 w-4 mr-2" />
                    Work History
                  </TabsTrigger>
                  <TabsTrigger value="raw-text">
                    <FileSearch className="h-4 w-4 mr-2" />
                    Raw Text
                  </TabsTrigger>
                  <TabsTrigger value="debug" className="bg-blue-50 border border-blue-200">
                    <AlertCircle className="h-4 w-4 mr-2 text-blue-600" />
                    LLM Response & Debug
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="skills">
                  <ResumeSkillsTab
                    analysis={analysis}
                    analysisLoading={analysisLoading || isAnalysisLoading}
                    analysisError={analysisError}
                    resumeId={resumeId!}
                    runSkillsAnalysis={runSkillsAnalysis}
                    setAnalysisLoading={setAnalysisLoading}
                  />
                </TabsContent>
                
                <TabsContent value="history">
                  <ResumeWorkHistoryTab
                    redFlagData={redFlagData}
                    redFlagLoading={redFlagLoading}
                    isRedFlagLoading={isRedFlagLoading}
                    redFlagError={redFlagError}
                    analysis={{
                      ...analysis,
                      resumeData: resume // Pass the resume data with extracted text
                    }}
                    runSkillsAnalysis={runSkillsAnalysis} // Add ability to re-analyze from work history tab
                  />
                </TabsContent>
                
                <TabsContent value="raw-text">
                  {resume && resume.extractedText ? (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg font-medium flex items-center">
                          <FileSearch className="h-5 w-5 mr-2 text-primary" />
                          Extracted Resume Text 
                          <span className="text-xs font-normal ml-2 text-gray-500">(directly extracted from PDF)</span>
                        </h3>
                        <div className="flex items-center text-sm text-gray-500">
                          <FileText className="h-4 w-4 mr-1" />
                          <span>{(resume.extractedText.length / 1000).toFixed(1)}K characters</span>
                        </div>
                      </div>
                      
                      {/* Check if AI analysis might be inconsistent */}
                      {analysis && analysis.analysis_warning && (
                        <Alert className="bg-amber-50 border-amber-200">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <AlertDescription className="text-amber-800">
                            {analysis.analysis_warning} The raw text below shows the actual content of the resume.
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {/* Show actual resume content */}
                      <div className="border rounded-md p-4 bg-slate-50 overflow-auto max-h-[500px]">
                        <pre className="text-sm whitespace-pre-wrap font-mono text-slate-800">{resume.extractedText}</pre>
                      </div>
                      
                      {/* Additional context about this tab */}
                      <div className="text-xs text-gray-500 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        This tab shows the raw text extracted from the resume PDF, not the AI's analysis.
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-40 text-gray-400">
                      <p>No extracted text found for this resume.</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="debug">
                  <div className="space-y-6">
                    <Alert className="border-blue-200 bg-blue-50">
                      <div className="flex items-center flex-wrap gap-2">
                        <Zap className="h-4 w-4 text-blue-600 mr-2" />
                        <h3 className="font-medium text-blue-900">Raw LLM Response</h3>
                        <div className="flex gap-2 ml-auto">
                          <TestParserBtn />
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              console.log("DEBUG RAW RESPONSE:", analysis?.rawResponse);
                              if (analysis?.rawResponse) {
                                try {
                                  if (typeof analysis.rawResponse === 'string') {
                                    console.log("RAW RESPONSE IS STRING, LENGTH:", analysis.rawResponse.length);
                                    if (analysis.rawResponse.includes("Work_History") && 
                                        analysis.rawResponse.includes("Skills") && 
                                        analysis.rawResponse.includes("Red_Flags")) {
                                      console.log("FOUND EXPECTED FIELDS IN RAW RESPONSE!");
                                    }
                                  } else {
                                    console.log("RAW RESPONSE IS OBJECT:", Object.keys(analysis.rawResponse));
                                    if (analysis.rawResponse.parsedJson) {
                                      console.log("PARSED JSON KEYS:", Object.keys(analysis.rawResponse.parsedJson));
                                    }
                                  }
                                } catch (e) {
                                  console.error("Error inspecting raw response:", e);
                                }
                              }
                            }}
                          >
                            Debug Raw Response
                          </Button>
                          <Button 
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-1"
                            onClick={() => {
                              if (resumeId) {
                                setAnalysisLoading(true);
                                runSkillsAnalysis().then(() => {
                                  console.log("Analysis complete");
                                });
                              }
                            }}
                          >
                            <RefreshCw className="h-3 w-3" /> Re-analyze Resume
                          </Button>
                        </div>
                      </div>
                      <AlertDescription className="mt-4">
                        <p className="text-sm text-blue-800 mb-2">
                          This is the raw response from the AI model. It contains the structured data used to populate the UI.
                        </p>
                        
                        <div className="mt-2 p-4 bg-slate-900 rounded-md overflow-auto max-h-96">
                          <pre className="text-xs whitespace-pre-wrap font-mono text-green-400">
                            {typeof analysis?.rawResponse === 'string' 
                              ? (analysis.rawResponse.startsWith('{') 
                                 ? analysis.rawResponse // Already valid JSON string
                                 : JSON.stringify(analysis.rawResponse, null, 2)) // Non-JSON string
                              : JSON.stringify(analysis?.rawResponse, null, 2)}
                          </pre>
                        </div>
                        
                        {/* Enhanced Debug Panel */}
                        <DebugPanel 
                          resumeId={resumeId!}
                          analysis={analysis}
                          redFlagData={redFlagData}
                        />
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}