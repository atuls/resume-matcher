import React from 'react';
import { ParsedDataViewer } from '@/components/ParsedDataViewer';

export default function StructuredDataParserPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Structured Data Parser</h1>
        <p className="text-gray-500 mt-1">
          Extract structured data from raw AI responses for easy viewing and debugging
        </p>
      </div>
      
      <ParsedDataViewer />
    </div>
  );
}