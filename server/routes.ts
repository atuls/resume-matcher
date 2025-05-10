import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import {
  analyzeJobDescription,
  analyzeResume,
  generateCustomPrompt,
} from "./services/aiService";
import {
  extractTextFromFile,
  parseJobDescription,
  parseResume,
} from "./services/documentProcessor";
import {
  extractSkillsFromResume,
  extractWorkHistory
} from "./services/skillsExtractor";
import {
  analyzeRequirementsSchema,
  analyzeResumeSchema,
  insertJobDescriptionSchema,
  insertJobRequirementSchema,
  insertResumeSchema,
  updateRequirementSchema,
} from "@shared/schema";

// Configure multer for memory storage of uploaded files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  const apiRouter = app.route("/api");

  // Job Description endpoints
  app.get("/api/job-descriptions", async (req: Request, res: Response) => {
    try {
      const jobDescriptions = await storage.getAllJobDescriptions();
      res.json(jobDescriptions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job descriptions" });
    }
  });

  app.get("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const jobDescription = await storage.getJobDescription(req.params.id);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }
      res.json(jobDescription);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job description" });
    }
  });

  app.post(
    "/api/job-descriptions",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        // Extract text from the uploaded file
        const extractedText = await extractTextFromFile(
          req.file.buffer,
          req.file.originalname
        );

        // Parse job description to get title and other metadata
        const { title, company, description } = parseJobDescription(extractedText);

        // Prepare job description data
        const jobDescriptionData = {
          title,
          company: company || null,
          description,
          rawContent: extractedText,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
        };

        // Validate data
        const validatedData = insertJobDescriptionSchema.parse(jobDescriptionData);

        // Save job description
        const savedJobDescription = await storage.createJobDescription(validatedData);

        res.status(201).json(savedJobDescription);
      } catch (error) {
        console.error("Error uploading job description:", error);
        res.status(500).json({
          message: "Failed to process job description",
          error: error.message,
        });
      }
    }
  );

  app.delete("/api/job-descriptions/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteJobDescription(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Job description not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete job description" });
    }
  });

  // Job Requirements endpoints
  app.get(
    "/api/job-descriptions/:id/requirements",
    async (req: Request, res: Response) => {
      try {
        const requirements = await storage.getJobRequirements(req.params.id);
        res.json(requirements);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch job requirements" });
      }
    }
  );

  app.post(
    "/api/job-descriptions/:id/analyze-requirements",
    async (req: Request, res: Response) => {
      try {
        const { jobDescriptionId } = analyzeRequirementsSchema.parse({
          jobDescriptionId: req.params.id,
        });

        // Get job description
        const jobDescription = await storage.getJobDescription(jobDescriptionId);
        if (!jobDescription) {
          return res
            .status(404)
            .json({ message: "Job description not found" });
        }

        // Analyze job description to extract requirements
        const analysisResult = await analyzeJobDescription(
          jobDescription.rawContent
        );

        // Save requirements to storage
        const savedRequirements = [];
        for (const req of analysisResult.requirements) {
          const requirementData = {
            jobDescriptionId,
            requirement: req.requirement,
            importance: req.importance,
            tags: req.tags,
          };

          const validatedData =
            insertJobRequirementSchema.parse(requirementData);
          const savedRequirement = await storage.createJobRequirement(
            validatedData
          );
          savedRequirements.push(savedRequirement);
        }

        res.json({ requirements: savedRequirements });
      } catch (error) {
        console.error("Error analyzing job requirements:", error);
        res.status(500).json({
          message: "Failed to analyze job requirements",
          error: error.message,
        });
      }
    }
  );

  app.put(
    "/api/job-requirements/:id",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const updateData = updateRequirementSchema.parse({
          id,
          ...req.body,
        });

        const updatedRequirement = await storage.updateJobRequirement(
          id,
          updateData
        );
        if (!updatedRequirement) {
          return res.status(404).json({ message: "Requirement not found" });
        }

        res.json(updatedRequirement);
      } catch (error) {
        res.status(500).json({
          message: "Failed to update job requirement",
          error: error.message,
        });
      }
    }
  );

  app.delete(
    "/api/job-requirements/:id",
    async (req: Request, res: Response) => {
      try {
        const success = await storage.deleteJobRequirement(req.params.id);
        if (!success) {
          return res.status(404).json({ message: "Requirement not found" });
        }
        res.status(204).send();
      } catch (error) {
        res
          .status(500)
          .json({ message: "Failed to delete job requirement" });
      }
    }
  );

  // Resume endpoints
  app.get("/api/resumes", async (req: Request, res: Response) => {
    try {
      const resumes = await storage.getAllResumes();
      res.json(resumes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch resumes" });
    }
  });

  app.get("/api/resumes/:id", async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      res.json(resume);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch resume" });
    }
  });
  
  app.get("/api/resumes/:id/analysis", async (req: Request, res: Response) => {
    try {
      const resume = await storage.getResume(req.params.id);
      if (!resume) {
        return res.status(404).json({ message: "Resume not found" });
      }
      
      // Extract skills and work history in parallel
      const [skills, workHistory] = await Promise.all([
        extractSkillsFromResume(resume.extractedText),
        extractWorkHistory(resume.extractedText)
      ]);
      
      res.json({
        skills,
        workHistory,
        resumeId: resume.id
      });
    } catch (error) {
      console.error("Error analyzing resume:", error);
      res.status(500).json({ 
        message: "Failed to analyze resume", 
        error: error.message 
      });
    }
  });

  app.post(
    "/api/resumes",
    upload.single("file"),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        // Extract text from the uploaded file
        const extractedText = await extractTextFromFile(
          req.file.buffer,
          req.file.originalname
        );

        // Parse resume to extract candidate info
        const { candidateName, candidateTitle } = parseResume(extractedText);

        // Prepare resume data
        const resumeData = {
          candidateName: candidateName || null,
          candidateTitle: candidateTitle || null,
          rawContent: req.file.buffer.toString("base64"),
          extractedText,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileType: req.file.mimetype,
        };

        // Validate data
        const validatedData = insertResumeSchema.parse(resumeData);

        // Save resume
        const savedResume = await storage.createResume(validatedData);

        res.status(201).json(savedResume);
      } catch (error) {
        console.error("Error uploading resume:", error);
        res.status(500).json({
          message: "Failed to process resume",
          error: error.message,
        });
      }
    }
  );

  app.delete("/api/resumes/:id", async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteResume(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Resume not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete resume" });
    }
  });

  // Analysis endpoints
  app.post(
    "/api/analyze",
    async (req: Request, res: Response) => {
      try {
        const { jobDescriptionId, resumeIds } = analyzeResumeSchema.parse(
          req.body
        );

        // Get job description
        const jobDescription = await storage.getJobDescription(jobDescriptionId);
        if (!jobDescription) {
          return res
            .status(404)
            .json({ message: "Job description not found" });
        }

        // Get job requirements
        const requirements = await storage.getJobRequirements(jobDescriptionId);
        if (requirements.length === 0) {
          return res.status(400).json({
            message:
              "No requirements found. Please analyze the job description first.",
          });
        }

        // Process each resume
        const results = [];
        for (const resumeId of resumeIds) {
          // Get resume
          const resume = await storage.getResume(resumeId);
          if (!resume) {
            return res.status(404).json({
              message: `Resume with ID ${resumeId} not found`,
            });
          }

          // Check if analysis already exists
          const existingAnalysis = await storage.getAnalysisResultForResume(
            resumeId,
            jobDescriptionId
          );
          if (existingAnalysis) {
            results.push(existingAnalysis);
            continue;
          }

          // Analyze resume
          const analysisResult = await analyzeResume(
            resume.extractedText,
            jobDescription.description,
            requirements.map((r) => ({
              requirement: r.requirement,
              importance: r.importance,
              tags: r.tags,
            }))
          );

          // Save analysis result
          const resultData = {
            jobDescriptionId,
            resumeId,
            overallScore: analysisResult.overallScore,
            skillMatches: analysisResult.skillMatches,
          };

          const savedResult = await storage.createAnalysisResult(resultData);
          
          // Also update resume with candidate name and title if available
          if (analysisResult.candidateName || analysisResult.candidateTitle) {
            await storage.updateResume(resumeId, {
              candidateName: analysisResult.candidateName || resume.candidateName,
              candidateTitle: analysisResult.candidateTitle || resume.candidateTitle,
            });
          }

          results.push(savedResult);
        }

        res.json({ results });
      } catch (error) {
        console.error("Error analyzing resumes:", error);
        res.status(500).json({
          message: "Failed to analyze resumes",
          error: error.message,
        });
      }
    }
  );

  app.get(
    "/api/job-descriptions/:id/results",
    async (req: Request, res: Response) => {
      try {
        const results = await storage.getAnalysisResultsByJob(req.params.id);
        
        // Enrich results with resume data
        const enrichedResults = [];
        for (const result of results) {
          const resume = await storage.getResume(result.resumeId);
          if (resume) {
            enrichedResults.push({
              ...result,
              resume: {
                id: resume.id,
                candidateName: resume.candidateName,
                candidateTitle: resume.candidateTitle,
                fileName: resume.fileName,
                fileType: resume.fileType,
              },
            });
          }
        }
        
        res.json(enrichedResults);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch analysis results" });
      }
    }
  );
  
  // Endpoint to get matching scores for specific resumes with a job
  app.get(
    "/api/job-descriptions/:id/resume-scores",
    async (req: Request, res: Response) => {
      try {
        const { id } = req.params;
        const resumeIds = Array.isArray(req.query.resumeId) 
          ? req.query.resumeId as string[] 
          : req.query.resumeId 
            ? [req.query.resumeId as string]
            : [];
        
        if (resumeIds.length === 0) {
          return res.json({});
        }
        
        // Get all analysis results for the job
        const results = await storage.getAnalysisResultsByJob(id);
        
        if (!results || results.length === 0) {
          return res.json({});
        }
        
        // Filter by requested resume IDs and format the response
        const scoreMap: { [resumeId: string]: { score: number, matchedAt: Date } } = {};
        
        results.forEach(result => {
          if (resumeIds.includes(result.resumeId)) {
            scoreMap[result.resumeId] = {
              score: result.overallScore,
              matchedAt: result.createdAt
            };
          }
        });
        
        res.json(scoreMap);
      } catch (error) {
        console.error("Error getting resume scores:", error);
        res.status(500).json({ message: "Failed to get resume scores" });
      }
    }
  );

  // Custom prompts endpoint
  app.post("/api/custom-prompt", async (req: Request, res: Response) => {
    try {
      const { jobDescriptionId, customInstructions } = req.body;

      // Get job description
      const jobDescription = await storage.getJobDescription(jobDescriptionId);
      if (!jobDescription) {
        return res.status(404).json({ message: "Job description not found" });
      }

      // Get job requirements
      const requirements = await storage.getJobRequirements(jobDescriptionId);
      const requirementsText = requirements
        .map((r) => `- ${r.requirement} (${r.importance})`)
        .join("\n");

      // Generate custom prompt
      const prompt = await generateCustomPrompt(
        jobDescription.description,
        requirementsText,
        customInstructions
      );

      res.json({ prompt });
    } catch (error) {
      res.status(500).json({
        message: "Failed to generate custom prompt",
        error: error.message,
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
