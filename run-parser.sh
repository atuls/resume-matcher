#!/bin/bash

# Run the parsing script to process raw_response data into structured fields
# This script extracts data from raw_response and populates the parsed_* fields

echo "Running parser script to extract structured data from raw responses"
echo "This will update the parsed_* fields in the database"

# Run the parser script with typescript support
npx tsx parse-raw-responses-fixed.ts

# Check the exit status
if [ $? -eq 0 ]; then
  echo "Parsing completed successfully"
else
  echo "Parsing failed with an error"
fi