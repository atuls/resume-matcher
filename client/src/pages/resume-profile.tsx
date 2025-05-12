import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getResume, getResumeAnalysis, getJobDescriptions, getResumeScores, updateResumeContactedStatus, getResumeRedFlagAnalysis } from "@/lib/api";
import { 
  User, FileText, Calendar, ArrowLeft, Mail, MapPin, Phone, Award, 
  Briefcase, Code, AlertCircle, BarChart3, CheckCircle, XCircle,
  RefreshCw, UserCheck, Sparkles, AlertTriangle
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { formatDistance } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import MatchJobDialog from "@/components/resume/match-job-dialog";
import JobConnectionManager from "@/components/candidate/job-connection-manager";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ResumeProfilePage() {
  const [, params] = useRoute<{ id: string }>("/resume/:id");
  const resumeId = params?.id;
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [resumeScore, setResumeScore] = useState<{score: number, matchedAt: Date} | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState<boolean>(false);
  const [redFlagLoading, setRedFlagLoading] = useState<boolean>(false);
  const [isContactedLoading, setIsContactedLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: resume, isLoading: resumeLoading, isError: resumeError } = useQuery({
    queryKey: [`/api/resumes/${resumeId}`],
    queryFn: () => getResume(resumeId!),
    enabled: !!resumeId,
  });

  // State for force rerunning analysis
  const [forceRerun, setForceRerun] = useState<boolean>(false);
  
  // Query parameters for analysis
  const analysisQueryKey = [`/api/resumes/${resumeId}/analysis`, selectedJobId, forceRerun];
  
  const { 
    data: analysis, 
    isLoading: isAnalysisLoading, 
    isError: analysisError,
    refetch: refetchAnalysis
  } = useQuery({
    queryKey: analysisQueryKey,
    queryFn: () => {
      if (selectedJobId) {
        return getResumeAnalysis(resumeId!, selectedJobId, forceRerun);
      } else {
        // If no job ID selected, just use base resume analysis
        return getResumeAnalysis(resumeId!);
      }
    },
    enabled: !!resumeId,
  });
  
  // Red flag analysis query
  const redFlagQueryKey = [`/api/resumes/${resumeId}/red-flag-analysis`, selectedJobId];
  
  const { 
    data: redFlagData, 
    isLoading: isRedFlagLoading, 
    isError: redFlagError,
    refetch: refetchRedFlagAnalysis
  } = useQuery({
    queryKey: redFlagQueryKey,
    queryFn: () => {
      if (selectedJobId) {
        return getResumeRedFlagAnalysis(resumeId!, selectedJobId);
      } else {
        return getResumeRedFlagAnalysis(resumeId!);
      }
    },
    enabled: !!resumeId,
  });
  
  // Fetch job descriptions for dropdown
  const { data: jobDescriptions } = useQuery({
    queryKey: ['/api/job-descriptions'],
    queryFn: getJobDescriptions
  });
  
  // Fetch job match scores when job is selected
  useEffect(() => {
    const fetchScore = async () => {
      if (selectedJobId && resumeId) {
        try {
          const scores = await getResumeScores([resumeId], selectedJobId);
          setResumeScore(scores[resumeId] || null);
        } catch (error) {
          console.error("Error fetching score:", error);
          setResumeScore(null);
        }
      } else {
        setResumeScore(null);
      }
    };
    
    fetchScore();
  }, [selectedJobId, resumeId]);

  // Function to toggle contacted status
  const handleContactedToggle = async (checked: boolean) => {
    if (!resumeId) return;
    
    try {
      setIsContactedLoading(true);
      
      // Update the status in the database
      await updateResumeContactedStatus(resumeId, checked);
      
      // Invalidate the query to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/resumes/${resumeId}`] });
      
      toast({
        title: checked ? "Marked as contacted" : "Marked as not contacted",
        description: checked 
          ? "Candidate has been marked as contacted in Rippling" 
          : "Candidate has been marked as not contacted in Rippling",
      });
    } catch (error) {
      toast({
        title: "Failed to update status",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsContactedLoading(false);
    }
  };

  const formatDate = (dateString: Date) => {
    try {
      return formatDistance(new Date(dateString), new Date(), {
        addSuffix: true,
      });
    } catch (error) {
      return "Invalid date";
    }
  };

  if (resumeLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-3">Loading resume...</span>
      </div>
    );
  }

  if (resumeError || !resume) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 text-red-600 rounded-lg p-4 mb-4">
          Failed to load resume. The resume may have been deleted or doesn't exist.
        </div>
        <Link href="/candidates">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Candidates
          </Button>
        </Link>
      </div>
    );
  }

  // Parse full name from candidate name or default to filename
  const candidateName = resume.candidateName || resume.fileName.split('.')[0].replace(/_/g, ' ');
  const candidateTitle = resume.candidateTitle || "Candidate";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Link href="/candidates">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Resume Profile</h1>
        </div>
        <div className="text-sm text-gray-500">
          Uploaded {formatDate(resume.createdAt)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center">
                <div className="h-24 w-24 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="h-12 w-12 text-gray-400" />
                </div>
              </div>
              <CardTitle className="mt-2">{candidateName}</CardTitle>
              <CardDescription>{candidateTitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mt-4">
                <div className="flex items-center text-sm">
                  <FileText className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">{resume.fileName}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">Uploaded {formatDate(resume.createdAt)}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Mail className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">Email: contact@example.com</span>
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">Phone: +1 (555) 123-4567</span>
                </div>
                <div className="flex items-center text-sm">
                  <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-gray-600">Location: New York, NY</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {resume && <MatchJobDialog resume={resume} />}
              
              <div className="mt-4 mb-2">
                <h3 className="text-sm font-medium mb-2 text-gray-500">View Score for Job</h3>
                <Select 
                  value={selectedJobId || "none"} 
                  onValueChange={(val) => setSelectedJobId(val === "none" ? null : val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {jobDescriptions?.map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedJobId && (
                <div className="border border-gray-100 rounded-lg p-3 my-3 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium">Job Match Analysis</h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => {
                        setForceRerun(true);
                        setAnalysisLoading(true);
                        
                        toast({
                          title: "Rerunning analysis...",
                          description: "This might take a few moments",
                        });
                        
                        refetchAnalysis()
                          .then(() => {
                            toast({
                              title: "Analysis completed",
                              description: "Resume has been reanalyzed successfully",
                              variant: "default",
                            });
                          })
                          .catch((error) => {
                            toast({
                              title: "Analysis failed",
                              description: error instanceof Error ? error.message : "An unexpected error occurred",
                              variant: "destructive",
                            });
                          })
                          .finally(() => {
                            setForceRerun(false);
                            setAnalysisLoading(false);
                          });
                      }}
                      disabled={isAnalysisLoading || analysisLoading}
                    >
                      {isAnalysisLoading || analysisLoading ? (
                        <>
                          <div className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-1.5 h-3 w-3" />
                          Force Rerun Analysis
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {resumeScore ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Match Score</span>
                        <Badge 
                          variant={
                            resumeScore.score >= 80 ? "secondary" :
                            resumeScore.score >= 60 ? "default" :
                            "outline"
                          } 
                          className={resumeScore.score >= 80 ? "bg-emerald-500" : ""}
                        >
                          {resumeScore.score}%
                        </Badge>
                      </div>
                      <Progress 
                        value={resumeScore.score} 
                        max={100}
                        className={`h-2 ${
                          resumeScore.score >= 80 ? "bg-emerald-100" :
                          resumeScore.score >= 60 ? "bg-blue-100" :
                          "bg-gray-100"
                        }`}
                      />
                      <div className="text-xs text-gray-500 flex items-center justify-between">
                        <span>Matched {formatDate(resumeScore.matchedAt)}</span>
                        {resumeScore.score >= 80 ? (
                          <span className="flex items-center text-emerald-600">
                            <CheckCircle className="h-3 w-3 mr-1" /> Great match
                          </span>
                        ) : resumeScore.score >= 60 ? (
                          <span className="flex items-center text-blue-600">
                            <CheckCircle className="h-3 w-3 mr-1" /> Good match
                          </span>
                        ) : (
                          <span className="flex items-center text-gray-500">
                            <XCircle className="h-3 w-3 mr-1" /> Low match
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-4 text-gray-500">
                      <AlertCircle className="mr-2 h-4 w-4" />
                      <span>Not matched yet</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="border border-gray-200 rounded-lg p-3 my-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UserCheck className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium">Contacted in Rippling</span>
                  </div>
                  <Switch 
                    checked={resume?.contactedInRippling || false}
                    onCheckedChange={handleContactedToggle}
                    disabled={isContactedLoading}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Mark this candidate as contacted in Rippling
                </p>
              </div>
              
              <Button className="w-full" variant="outline" >
                <Mail className="mr-2 h-4 w-4" />
                Contact Candidate
              </Button>
              <Button className="w-full" variant="outline" >
                <Code className="mr-2 h-4 w-4" />
                Schedule Interview
              </Button>
              
              <Card className="mt-4">
                <CardHeader className="py-2">
                  <CardTitle className="text-md">Job Connections</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {resumeId && <JobConnectionManager resumeId={resumeId} />}
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card>
            <Tabs defaultValue="match-analysis">
              <CardHeader className="pb-2">
                <TabsList>
                  <TabsTrigger value="match-analysis">Job Match Analysis</TabsTrigger>
                  <TabsTrigger value="raw">Raw Text</TabsTrigger>
                  <TabsTrigger value="skills">Skills</TabsTrigger>
                  <TabsTrigger value="history">Work History</TabsTrigger>
                  <TabsTrigger value="red-flags">Red Flags</TabsTrigger>
                  <TabsTrigger value="debug">Debug Info</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="match-analysis">
                  <div className="space-y-6">
                    {/* Job match score section */}
                    <div className="bg-gray-50 p-4 rounded-md border">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-medium text-lg">Job Match Analysis</h3>
                        <div className="flex items-center">
                          {selectedJobId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 mr-2"
                              onClick={() => {
                                setForceRerun(true);
                                setAnalysisLoading(true);
                                refetchAnalysis()
                                  .then(() => {
                                    setForceRerun(false);
                                    toast({
                                      title: "Analysis updated",
                                      description: "Resume analysis has been refreshed.",
                                    });
                                  })
                                  .catch((error) => {
                                    toast({
                                      title: "Analysis failed",
                                      description: error instanceof Error ? error.message : "An unexpected error occurred",
                                      variant: "destructive",
                                    });
                                  })
                                  .finally(() => {
                                    setAnalysisLoading(false);
                                  });
                              }}
                              disabled={analysisLoading || isAnalysisLoading}
                            >
                              <RefreshCw className="h-4 w-4" />
                              Force Rerun Analysis
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {!selectedJobId ? (
                        <div className="text-center py-6 space-y-3">
                          <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-gray-100">
                            <Briefcase className="h-8 w-8 text-gray-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-700">Select a job to analyze this resume against</p>
                            <p className="text-sm text-gray-500 mt-1">Choose a job description to see how this candidate matches</p>
                          </div>
                          <MatchJobDialog resumeIds={[resumeId!]} onMatchComplete={() => {
                            refetchAnalysis();
                          }} />
                        </div>
                      ) : isAnalysisLoading || analysisLoading ? (
                        <div className="py-8 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
                            <p className="text-sm font-medium">Analyzing resume against job requirements...</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">Match Score</span>
                              <span className="font-bold text-lg">{resumeScore?.score || analysis?.analysis?.score || 0}%</span>
                            </div>
                            <Progress value={resumeScore?.score || analysis?.analysis?.score || 0} className="h-3" />
                            <p className="text-xs text-gray-500 mt-1">
                              Matched {resumeScore ? formatDate(resumeScore.matchedAt) : 'recently'}
                            </p>
                          </div>
                          
                          <div className="border-t pt-3">
                            <h4 className="text-sm font-medium mb-2">Matched Requirements</h4>
                            <div className="space-y-2">
                              {analysis?.analysis?.matchedRequirements ? (
                                analysis.analysis.matchedRequirements.map((req) => (
                                  <div key={req.requirement} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center">
                                      {req.matched ? (
                                        <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                      ) : (
                                        <XCircle className="h-4 w-4 mr-2 text-red-500" />
                                      )}
                                      <span className={req.matched ? "text-gray-900" : "text-gray-500"}>
                                        {req.requirement}
                                      </span>
                                    </div>
                                    <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded">
                                      {Math.round(req.confidence * 100)}%
                                    </span>
                                  </div>
                                ))
                              ) : (
                                <p className="text-gray-500 text-sm italic">No requirement matching data available</p>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="raw">
                  <div className="bg-gray-50 p-4 rounded-md whitespace-pre-wrap font-mono text-sm h-[500px] overflow-y-auto">
                    {resume.extractedText}
                  </div>
                </TabsContent>
                
                <TabsContent value="skills">
                  {analysisLoading ? (
                    <div className="flex justify-center items-center h-36">
                      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
                      <span className="ml-3 text-sm">Analyzing skills...</span>
                    </div>
                  ) : analysisError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Failed to analyze skills. Please try again later.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4">
                      {(() => {
                        // Get skills from either dedicated analysis or job match analysis
                        let skillsList: string[] = [];
                        
                        // Check if skills are available in the analysis object directly
                        if (analysis?.skills && analysis.skills.length > 0) {
                          skillsList = analysis.skills;
                        } 
                        // If not, check if available in analysis.analysis.skills
                        else if (analysis?.analysis?.skills && analysis.analysis.skills.length > 0) {
                          skillsList = analysis.analysis.skills;
                        }
                        
                        if (skillsList.length > 0) {
                          // Define soft skills for filtering
                          const softSkillKeywords = ['communication', 'teamwork', 'leadership', 'problem solving', 
                                                'adaptability', 'time management', 'creativity', 'critical thinking',
                                                'collaboration', 'presentation', 'interpersonal', 'organization', 
                                                'flexibility', 'negotiation', 'conflict resolution'];
                          
                          // Filter for technical vs soft skills
                          const technicalSkills = skillsList.filter(skill => 
                            !softSkillKeywords.some(softSkill => 
                              skill.toLowerCase().includes(softSkill.toLowerCase())
                            )
                          );
                          
                          const softSkills = skillsList.filter(skill => 
                            softSkillKeywords.some(softSkill => 
                              skill.toLowerCase().includes(softSkill.toLowerCase())
                            )
                          );
                          
                          return (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="bg-primary/5 p-4 rounded-lg">
                                  <h4 className="font-medium mb-2">Technical Skills</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {technicalSkills.length > 0 ? (
                                      technicalSkills.map((skill, index) => (
                                        <span key={index} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                                          {skill}
                                        </span>
                                      ))
                                    ) : (
                                      <p className="text-sm text-gray-500">No technical skills detected</p>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="bg-primary/5 p-4 rounded-lg">
                                  <h4 className="font-medium mb-2">Soft Skills</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {softSkills.length > 0 ? (
                                      softSkills.map((skill, index) => (
                                        <span key={index} className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-sm">
                                          {skill}
                                        </span>
                                      ))
                                    ) : (
                                      <p className="text-sm text-gray-500">No soft skills detected</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-4">
                                <p className="text-sm text-gray-500 italic">
                                  Note: Skills are extracted from resume content using AI and may require verification.
                                </p>
                              </div>
                            </>
                          );
                        } else {
                          return (
                            <div className="text-center py-8">
                              <p className="text-gray-500">No skills detected in this resume.</p>
                              {selectedJobId && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="mt-4"
                                  onClick={() => {
                                    setForceRerun(true);
                                    setAnalysisLoading(true);
                                    refetchAnalysis()
                                      .then(() => {
                                        setForceRerun(false);
                                        toast({
                                          title: "Analysis updated",
                                          description: "Resume skills analysis has been refreshed.",
                                        });
                                      })
                                      .catch((error) => {
                                        toast({
                                          title: "Analysis failed",
                                          description: error instanceof Error ? error.message : "An unexpected error occurred",
                                          variant: "destructive",
                                        });
                                      })
                                      .finally(() => {
                                        setAnalysisLoading(false);
                                      });
                                  }}
                                >
                                  Run Skills Analysis
                                </Button>
                              )}
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="history">
                  {redFlagLoading || isRedFlagLoading ? (
                    <div className="flex justify-center items-center h-36">
                      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
                      <span className="ml-3 text-sm">Analyzing work history...</span>
                    </div>
                  ) : redFlagError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Failed to analyze work history. Please try again later.
                      </AlertDescription>
                    </Alert>
                  ) : redFlagData?.analysis?.recentRoles && redFlagData.analysis.recentRoles.length > 0 ? (
                    <div className="space-y-6">
                      {redFlagData.analysis.recentRoles.map((job, index) => (
                        <div key={index} className="border-l-2 border-gray-200 pl-4 pb-4">
                          <div className="relative">
                            <div className={`absolute -left-6 mt-1 h-4 w-4 rounded-full ${index === 0 ? 'bg-primary' : 'bg-gray-400'}`}></div>
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-medium">{job.title}</h4>
                                <p className="text-sm text-gray-600">{job.company}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">{job.durationMonths} months</p>
                                {job.isContract && (
                                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-xs">Contract</Badge>
                                )}
                              </div>
                            </div>
                            
                            {/* Additional work details if available would go here */}
                          </div>
                        </div>
                      ))}
                      
                      {/* Work history stats */}
                      <div className="bg-gray-50 rounded-lg p-4 mt-4">
                        <h4 className="font-medium mb-2">Career Summary</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-white p-3 rounded border">
                            <div className="text-sm text-gray-500">Average Tenure</div>
                            <div className="font-medium">
                              {redFlagData.analysis.averageTenureMonths} months
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <div className="text-sm text-gray-500">Employment Status</div>
                            <div className="font-medium flex items-center">
                              {redFlagData.analysis.isCurrentlyEmployed ? (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1.5 text-green-500" />
                                  Currently Employed
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 mr-1.5 text-gray-400" />
                                  Not Employed
                                </>
                              )}
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded border">
                            <div className="text-sm text-gray-500">Contract Experience</div>
                            <div className="font-medium">
                              {redFlagData.analysis.hasContractRoles ? "Yes" : "No"}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 italic">
                          Note: Work history is extracted from resume content using AI and may require verification.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No work history detected in this resume.</p>
                      {selectedJobId && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-4"
                          onClick={() => {
                            setRedFlagLoading(true);
                            refetchRedFlagAnalysis()
                              .then(() => {
                                toast({
                                  title: "Analysis updated",
                                  description: "Work history analysis has been refreshed.",
                                });
                              })
                              .catch((error) => {
                                toast({
                                  title: "Analysis failed",
                                  description: error instanceof Error ? error.message : "An unexpected error occurred",
                                  variant: "destructive",
                                });
                              })
                              .finally(() => {
                                setRedFlagLoading(false);
                              });
                          }}
                        >
                          Run Work History Analysis
                        </Button>
                      )}
                    </div>
                  )}
                </TabsContent>
                
                {/* Red Flags tab to show candidate potential issues */}
                <TabsContent value="red-flags">
                  {isRedFlagLoading || redFlagLoading ? (
                    <div className="flex justify-center items-center h-36">
                      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
                      <span className="ml-3 text-sm">Analyzing candidate profile...</span>
                    </div>
                  ) : redFlagError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Failed to load red flag analysis. Please try again later.
                      </AlertDescription>
                    </Alert>
                  ) : redFlagData ? (
                    <div className="space-y-6">
                      {/* Overall summary */}
                      <div className="space-y-3">
                        <h3 className="text-lg font-medium flex items-center">
                          <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                          Candidate Overview
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-sm text-gray-500">Current Employment</div>
                            <div className="font-medium flex items-center">
                              {redFlagData.analysis.isCurrentlyEmployed ? (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1.5 text-green-500" />
                                  Currently Employed
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 mr-1.5 text-gray-400" />
                                  Not Employed
                                </>
                              )}
                            </div>
                            {redFlagData.analysis.currentJobPosition && (
                              <div className="text-xs text-gray-500 mt-1">
                                {redFlagData.analysis.currentJobPosition}
                              </div>
                            )}
                          </div>
                          
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-sm text-gray-500">Avg. Job Tenure</div>
                            <div className="font-medium flex items-center">
                              <Briefcase className="h-4 w-4 mr-1.5 text-gray-500" />
                              {redFlagData.analysis.averageTenureMonths} months
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {redFlagData.analysis.averageTenureMonths < 12 ? (
                                "Short average tenure"
                              ) : redFlagData.analysis.averageTenureMonths < 24 ? (
                                "Moderate average tenure"
                              ) : (
                                "Good average tenure"
                              )}
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-sm text-gray-500">Job Stability</div>
                            <div className="font-medium flex items-center">
                              {redFlagData.analysis.hasJobHoppingHistory ? (
                                <>
                                  <AlertCircle className="h-4 w-4 mr-1.5 text-amber-500" />
                                  Job Hopping Detected
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1.5 text-green-500" />
                                  Stable Job History
                                </>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {redFlagData.analysis.hasContractRoles ? 
                                "Has held contract roles" : 
                                "No contract roles detected"}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Recent roles section */}
                      {redFlagData.analysis.recentRoles && redFlagData.analysis.recentRoles.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-lg font-medium flex items-center">
                            <Briefcase className="h-5 w-5 mr-2 text-gray-500" />
                            Recent Positions
                          </h3>
                          <div className="space-y-2">
                            {redFlagData.analysis.recentRoles.map((role, index) => (
                              <div key={index} className="border rounded-lg p-3">
                                <div className="flex justify-between">
                                  <div className="font-medium">{role.title}</div>
                                  <div className="text-sm text-gray-500">
                                    {role.durationMonths} months
                                  </div>
                                </div>
                                <div className="text-sm flex justify-between">
                                  <div className="text-gray-600">{role.company}</div>
                                  {role.isContract && (
                                    <Badge variant="outline" className="text-xs">Contract</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Red flags section */}
                      {redFlagData.analysis.redFlags && redFlagData.analysis.redFlags.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-lg font-medium flex items-center">
                            <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                            Potential Concerns
                          </h3>
                          <div className="space-y-2">
                            {redFlagData.analysis.redFlags.map((flag, index) => (
                              <Alert key={index} variant="outline" className="border-amber-200 bg-amber-50">
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                <AlertDescription className="text-amber-800">
                                  {flag}
                                </AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Highlights section */}
                      {redFlagData.analysis.highlights && redFlagData.analysis.highlights.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-lg font-medium flex items-center">
                            <Sparkles className="h-5 w-5 mr-2 text-blue-500" />
                            Candidate Highlights
                          </h3>
                          <div className="space-y-2">
                            {redFlagData.analysis.highlights.map((highlight, index) => (
                              <Alert key={index} variant="outline" className="border-blue-200 bg-blue-50">
                                <CheckCircle className="h-4 w-4 text-blue-500" />
                                <AlertDescription className="text-blue-800">
                                  {highlight}
                                </AlertDescription>
                              </Alert>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p>No analysis results available.</p>
                      {selectedJobId && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-4"
                          onClick={() => {
                            setRedFlagLoading(true);
                            toast({
                              title: "Running analysis...",
                              description: "Analyzing candidate profile for potential red flags",
                            });
                            
                            refetchRedFlagAnalysis()
                              .then(() => {
                                toast({
                                  title: "Analysis complete",
                                  description: "The red flag analysis has been successfully completed",
                                });
                              })
                              .catch((error) => {
                                toast({
                                  title: "Analysis failed",
                                  description: error instanceof Error ? error.message : "An unexpected error occurred",
                                  variant: "destructive",
                                });
                              })
                              .finally(() => {
                                setRedFlagLoading(false);
                              });
                          }}
                          disabled={redFlagLoading}
                        >
                          Run Analysis
                        </Button>
                      )}
                    </div>
                  )}
                </TabsContent>
                
                {/* Debug tab to show all raw LLM responses */}
                <TabsContent value="debug">
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium text-lg">Resume Analysis LLM Responses</h3>
                      <Badge variant="secondary" className="ml-2">
                        Resume ID: {resumeId}
                      </Badge>
                    </div>
                    
                    {/* Skills Analysis Response */}
                    <div className="rounded-md border overflow-hidden">
                      <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Skills & Requirements Analysis</h4>
                          <p className="text-xs text-gray-500">Resume analysis against job requirements</p>
                        </div>
                        <Badge className="bg-blue-500 text-white">
                          {analysis?.aiModel || 'No model info'}
                        </Badge>
                      </div>
                      {analysis?.rawResponse ? (
                        <pre className="p-4 overflow-auto text-xs max-h-80 bg-black text-green-400">
                          {JSON.stringify(analysis.rawResponse, null, 2)}
                        </pre>
                      ) : isAnalysisLoading || analysisLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No raw response data available. Try re-analyzing this resume.</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Red Flags Analysis Response */}
                    <div className="rounded-md border overflow-hidden">
                      <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">Red Flags & Work History Analysis</h4>
                          <p className="text-xs text-gray-500">Algorithm-based evaluation of work patterns</p>
                        </div>
                        <Badge variant="secondary">Date-based Algorithm</Badge>
                      </div>
                      {redFlagData ? (
                        <div className="space-y-4 p-4">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Work History Extracted:</h4>
                            <pre className="text-xs overflow-auto max-h-80 p-3 bg-gray-50 rounded-md">
                              {JSON.stringify(redFlagData.analysis.recentRoles, null, 2)}
                            </pre>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium mb-2">Analysis Results:</h4>
                            <pre className="text-xs overflow-auto max-h-80 p-3 bg-gray-50 rounded-md">
                              {JSON.stringify({
                                hasJobHoppingHistory: redFlagData.analysis.hasJobHoppingHistory,
                                hasContractRoles: redFlagData.analysis.hasContractRoles,
                                isCurrentlyEmployed: redFlagData.analysis.isCurrentlyEmployed,
                                averageTenureMonths: redFlagData.analysis.averageTenureMonths,
                                redFlags: redFlagData.analysis.redFlags,
                                highlights: redFlagData.analysis.highlights,
                                currentJobPosition: redFlagData.analysis.currentJobPosition
                              }, null, 2)}
                            </pre>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-gray-500">No red flags analysis data available.</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Request Current APIs button */}
                    <div className="flex justify-end">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          toast({
                            title: "Debug Info",
                            description: "All LLM responses are now displayed in this tab.",
                          });
                        }}
                      >
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Refresh Data
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}