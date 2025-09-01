import React, { useState } from 'react';
import { Code, Copy, Play } from 'lucide-react';

interface PythonArtifactProps {
  title: string;
  code: string;
}

const PythonArtifact: React.FC<PythonArtifactProps> = ({ title, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Code size={16} className="text-gray-600" />
          <span className="text-sm font-medium text-gray-800">{title}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-gray-200 transition-colors"
            title="Copy code"
          >
            <Copy size={14} className="text-gray-600" />
          </button>
          <button className="p-1.5 rounded-md hover:bg-gray-200 transition-colors" title="Run code">
            <Play size={14} className="text-gray-600" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <pre className="text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap font-mono">
          <code>{code}</code>
        </pre>
      </div>
      {copied && (
        <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs">
          Copied!
        </div>
      )}
    </div>
  );
};

export default PythonArtifact;
