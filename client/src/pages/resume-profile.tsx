import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getResume, getResumeAnalysis, getJobDescriptions, getResumeScores } from "@/lib/api";
import { 
  User, FileText, Calendar, ArrowLeft, Mail, MapPin, Phone, Award, 
  Briefcase, Code, AlertCircle, BarChart3, CheckCircle, XCircle,
  RefreshCw
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { formatDistance } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const { toast } = useToast();

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
            <Tabs defaultValue="overview">
              <CardHeader className="pb-2">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="raw">Raw Text</TabsTrigger>
                  <TabsTrigger value="skills">Skills</TabsTrigger>
                  <TabsTrigger value="history">Work History</TabsTrigger>
                  <TabsTrigger value="debug">Debug Info</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="overview">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-lg">Summary</h3>
                      <p className="text-gray-700 mt-2">{
                        resume.extractedText.slice(0, 250).trim() + "..."
                      }</p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-lg">Top Skills</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {isAnalysisLoading || analysisLoading ? (
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(i => (
                              <div key={i} className="h-8 w-20 bg-gray-200 animate-pulse rounded-full"></div>
                            ))}
                          </div>
                        ) : analysis?.skills?.length ? (
                          // Display skills from analysis if available
                          (analysis?.skills || []).slice(0, 7).map((skill) => (
                            <span key={skill} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                              {skill}
                            </span>
                          ))
                        ) : selectedJobId && analysis?.analysis?.skills ? (
                          // Display skills from job match analysis if available
                          (analysis?.analysis?.skills || []).slice(0, 7).map((skill) => (
                            <span key={skill} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                              {skill}
                            </span>
                          ))
                        ) : (
                          // Fallback to dummy skills
                          ['JavaScript', 'React', 'TypeScript', 'Node.js', 'Express', 'SQL', 'UI/UX'].map((skill) => (
                            <span key={skill} className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">
                              {skill}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium text-lg">Education</h3>
                      <div className="mt-2 border-l-2 border-gray-200 pl-4">
                        <div className="mb-2">
                          <p className="font-medium">Bachelor of Science in Computer Science</p>
                          <p className="text-sm text-gray-600">University of Technology</p>
                          <p className="text-sm text-gray-500">2015 - 2019</p>
                        </div>
                      </div>
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
                  ) : analysis?.skills?.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-primary/5 p-4 rounded-lg">
                          <h4 className="font-medium mb-2">Technical Skills</h4>
                          <div className="flex flex-wrap gap-2">
                            {(analysis?.skills || [])
                              .filter(skill => !['communication', 'teamwork', 'leadership', 'problem solving', 
                                            'adaptability', 'time management', 'creativity', 'critical thinking',
                                            'collaboration', 'presentation'].includes(skill.toLowerCase()))
                              .map((skill) => (
                                <span key={skill} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                                  {skill}
                                </span>
                              ))}
                          </div>
                        </div>
                        
                        <div className="bg-primary/5 p-4 rounded-lg">
                          <h4 className="font-medium mb-2">Soft Skills</h4>
                          <div className="flex flex-wrap gap-2">
                            {(analysis?.skills || [])
                              .filter(skill => ['communication', 'teamwork', 'leadership', 'problem solving', 
                                          'adaptability', 'time management', 'creativity', 'critical thinking',
                                          'collaboration', 'presentation'].includes(skill.toLowerCase()))
                              .map((skill) => (
                                <span key={skill} className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-sm">
                                  {skill}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 italic">
                          Note: Skills are extracted from resume content using AI and may require verification.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No skills detected in this resume.</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="history">
                  {analysisLoading ? (
                    <div className="flex justify-center items-center h-36">
                      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
                      <span className="ml-3 text-sm">Analyzing work history...</span>
                    </div>
                  ) : analysisError ? (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Failed to analyze work history. Please try again later.
                      </AlertDescription>
                    </Alert>
                  ) : analysis?.workHistory?.length > 0 ? (
                    <div className="space-y-6">
                      {(analysis?.workHistory || []).map((job, index) => (
                        <div key={index} className="border-l-2 border-gray-200 pl-4 pb-2">
                          <div className="relative">
                            <div className={`absolute -left-6 mt-1 h-4 w-4 rounded-full ${index === 0 ? 'bg-primary' : 'bg-gray-400'}`}></div>
                            <h4 className="font-medium">{job.title}</h4>
                            <p className="text-sm text-gray-600">{job.company}</p>
                            <p className="text-sm text-gray-500">{job.period}</p>
                            <p className="mt-2 text-sm text-gray-700">
                              {job.description}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div className="mt-4">
                        <p className="text-sm text-gray-500 italic">
                          Note: Work history is extracted from resume content using AI and may require verification.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No work history detected in this resume.</p>
                    </div>
                  )}
                </TabsContent>
                
                {/* Debug tab to show raw AI response */}
                <TabsContent value="debug">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-medium text-lg">AI Model Debug Information</h3>
                      <Badge variant="outline" className="ml-2">
                        {analysis?.aiModel || 'No model info'}
                      </Badge>
                    </div>
                    
                    {analysis?.rawResponse ? (
                      <div className="rounded-md border overflow-hidden">
                        <div className="p-4 bg-gray-50 border-b">
                          <h4 className="font-medium">Raw AI Response</h4>
                          <p className="text-xs text-gray-500">This is for debugging purposes only</p>
                        </div>
                        <pre className="p-4 overflow-auto text-xs max-h-96 bg-black text-green-400">
                          {JSON.stringify(analysis.rawResponse, null, 2)}
                        </pre>
                      </div>
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
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}