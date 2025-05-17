import { Express, Request, Response, NextFunction } from "express";
import { Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import {
  analysisResults,
  jobDescriptions,
  jobRequirements,
  resumes,
  candidateJobConnections
} from "@shared/schema";
import { count, desc, eq, and, not, like, gt, lt, isNull, sql, asc } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { handleRedFlagAnalysis } from "./redFlagHandler";

export async function registerRoutes(app: Express): Promise<Server> {
  // Basic API health check
  app.get("/api", (_req: Request, res: Response) => {
    res.json({ message: "API is running" });
  });

  // Get red flag analysis for a resume from the database
  app.get("/api/resumes/:id/red-flag-analysis", handleRedFlagAnalysis);

  // Create HTTP server
  const httpServer = app.listen(3000, () => {
    console.log("Server is running on port 3000");
  });

  return httpServer;
}