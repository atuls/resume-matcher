#!/bin/bash

# Script to parse raw responses in the database
# Usage: ./run-parser.sh [options]
#
# Options:
#   --job-id ID      Process only records for a specific job ID
#   --force          Force reprocessing of all matching records
#   --limit N        Process only N records (useful for testing)
#   --help           Show this help message

# Parse command line arguments
JOB_ID=""
FORCE=false
LIMIT=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --job-id)
      JOB_ID="--job-id $2"
      shift 2
      ;;
    --force)
      FORCE="--force"
      shift
      ;;
    --limit)
      LIMIT="--limit $2"
      shift 2
      ;;
    --help)
      echo "Usage: ./run-parser.sh [--job-id ID] [--force] [--limit N]"
      echo ""
      echo "Options:"
      echo "  --job-id ID      Process only records for a specific job ID"
      echo "  --force          Force reprocessing of all matching records"
      echo "  --limit N        Process only N records (useful for testing)"
      echo "  --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help to see available options"
      exit 1
      ;;
  esac
done

# Run the parser script to process raw responses
echo "Starting raw response parser..."
npx tsx parse-raw-responses-fixed.ts $JOB_ID $FORCE $LIMIT