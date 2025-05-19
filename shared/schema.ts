import { pgTable, text, serial, integer, boolean, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Users table (keeping from original)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Job descriptions table
export const jobDescriptions = pgTable("job_descriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  company: text("company"),
  description: text("description").notNull(),
  rawContent: text("raw_content").notNull(),
  fileName: text("file_name"),
  fileSize: integer("file_size"),
  fileType: text("file_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobDescriptionsRelations = relations(jobDescriptions, ({ many }) => ({
  requirements: many(jobRequirements),
  analysisResults: many(analysisResults),
  candidateConnections: many(candidateJobConnections),
}));

export const insertJobDescriptionSchema = createInsertSchema(jobDescriptions).omit({
  id: true,
  createdAt: true,
});

// Job requirements identified from job descriptions
export const jobRequirements = pgTable("job_requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobDescriptionId: uuid("job_description_id").notNull().references(() => jobDescriptions.id),
  requirement: text("requirement").notNull(),
  importance: text("importance").notNull(), // "Required", "Preferred", "Nice to have"
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobRequirementsRelations = relations(jobRequirements, ({ one }) => ({
  jobDescription: one(jobDescriptions, {
    fields: [jobRequirements.jobDescriptionId],
    references: [jobDescriptions.id],
  }),
}));

export const insertJobRequirementSchema = createInsertSchema(jobRequirements).omit({
  id: true,
  createdAt: true,
});

// Resumes table
export const resumes = pgTable("resumes", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateName: text("candidate_name"),
  candidateTitle: text("candidate_title"),
  rawContent: text("raw_content").notNull(),
  extractedText: text("extracted_text").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(),
  contactedInRippling: boolean("contacted_in_rippling").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const resumesRelations = relations(resumes, ({ many }) => ({
  analysisResults: many(analysisResults),
  jobConnections: many(candidateJobConnections),
}));

export const insertResumeSchema = createInsertSchema(resumes).omit({
  id: true,
  createdAt: true,
});

// Analysis results table
export const analysisResults = pgTable("analysis_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobDescriptionId: uuid("job_description_id").notNull().references(() => jobDescriptions.id),
  resumeId: uuid("resume_id").notNull().references(() => resumes.id),
  overallScore: integer("overall_score").notNull(),
  skillMatches: jsonb("skill_matches").notNull(),
  rawResponse: jsonb("raw_response"),
  aiModel: text("ai_model"),
  // New parsed fields
  parsedSkills: jsonb("parsed_skills"),
  parsedWorkHistory: jsonb("parsed_work_history"),
  parsedRedFlags: jsonb("parsed_red_flags"),
  parsedSummary: text("parsed_summary"),
  parsingStatus: text("parsing_status").default("pending"),
  // Single parsed JSON field containing all structured data
  parsedJson: jsonb("parsed_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const analysisResultsRelations = relations(analysisResults, ({ one }) => ({
  jobDescription: one(jobDescriptions, {
    fields: [analysisResults.jobDescriptionId],
    references: [jobDescriptions.id],
  }),
  resume: one(resumes, {
    fields: [analysisResults.resumeId],
    references: [resumes.id],
  }),
}));

export const insertAnalysisResultSchema = createInsertSchema(analysisResults).omit({
  id: true,
  createdAt: true,
});

// Candidate-Job Connection table
export const candidateJobConnections = pgTable("candidate_job_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  resumeId: uuid("resume_id").notNull().references(() => resumes.id),
  jobDescriptionId: uuid("job_description_id").notNull().references(() => jobDescriptions.id),
  status: text("status").notNull().default("pending"), // pending, matched, rejected, shortlisted
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const candidateJobConnectionsRelations = relations(candidateJobConnections, ({ one }) => ({
  resume: one(resumes, {
    fields: [candidateJobConnections.resumeId],
    references: [resumes.id],
  }),
  jobDescription: one(jobDescriptions, {
    fields: [candidateJobConnections.jobDescriptionId],
    references: [jobDescriptions.id],
  }),
}));

export const insertCandidateJobConnectionSchema = createInsertSchema(candidateJobConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Settings table
export const appSettings = pgTable("app_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type AppSettings = typeof appSettings.$inferSelect;
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;

export type JobDescription = typeof jobDescriptions.$inferSelect;
export type InsertJobDescription = z.infer<typeof insertJobDescriptionSchema>;

export type JobRequirement = typeof jobRequirements.$inferSelect;
export type InsertJobRequirement = z.infer<typeof insertJobRequirementSchema>;

export type Resume = typeof resumes.$inferSelect;
export type InsertResume = z.infer<typeof insertResumeSchema>;

export type AnalysisResult = typeof analysisResults.$inferSelect;
export type InsertAnalysisResult = z.infer<typeof insertAnalysisResultSchema>;

export type CandidateJobConnection = typeof candidateJobConnections.$inferSelect;
export type InsertCandidateJobConnection = z.infer<typeof insertCandidateJobConnectionSchema>;

// Additional validation schemas
export const fileUploadSchema = z.object({
  file: z.any(),
});

export const analyzeRequirementsSchema = z.object({
  jobDescriptionId: z.string().uuid(),
});

export const analyzeResumeSchema = z.object({
  jobDescriptionId: z.string().uuid(),
  resumeIds: z.array(z.string().uuid()),
});

export const updateRequirementSchema = z.object({
  id: z.string().uuid(),
  requirement: z.string().optional(),
  importance: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
