import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle, FileText, Brain, FileSearch, Download } from 'lucide-react';

interface GenerationStatusProps {
  isGenerating: boolean;
  status: string;
  documents: number;
  webSources: number;
}

export function GenerationStatus({ isGenerating, status, documents, webSources }: GenerationStatusProps) {
  if (!isGenerating && !status) return null;

  const getStatusIcon = () => {
    if (status.includes('complete')) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (status.includes('failed') || status.includes('Error')) return <AlertCircle className="h-5 w-5 text-red-600" />;
    if (status.includes('Collecting')) return <FileSearch className="h-5 w-5 text-blue-600 animate-pulse" />;
    if (status.includes('Analyzing') || status.includes('Summarizing')) return <Brain className="h-5 w-5 text-purple-600 animate-pulse" />;
    if (status.includes('Generating')) return <FileText className="h-5 w-5 text-indigo-600 animate-pulse" />;
    if (status.includes('Downloading')) return <Download className="h-5 w-5 text-green-600 animate-pulse" />;
    return <Loader2 className="h-5 w-5 animate-spin text-gray-600" />;
  };

  const getProgressSteps = () => {
    const steps = [
      { name: 'Collect Resources', active: status.includes('Collecting') },
      { name: 'Analyze Content', active: status.includes('Analyzing') },
      { name: 'Summarize Documents', active: status.includes('Summarizing') },
      { name: 'Generate Content', active: status.includes('Generating AI') },
      { name: 'Format Document', active: status.includes('Formatting') },
      { name: 'Download', active: status.includes('Downloading') || status.includes('complete') },
    ];

    return steps;
  };

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {getStatusIcon()}
          Generation Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status message */}
          <p className="text-sm text-gray-600">{status}</p>
          
          {/* Resource summary */}
          <div className="flex gap-4 text-sm text-gray-500">
            <span>Processing {documents} document{documents !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>{webSources} web source{webSources !== 1 ? 's' : ''}</span>
          </div>

          {/* Progress steps */}
          {isGenerating && (
            <div className="relative">
              <div className="flex items-center justify-between">
                {getProgressSteps().map((step, index) => (
                  <div key={step.name} className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                        ${step.active ? 'bg-blue-600 text-white' : 
                          status.includes('complete') || index < getProgressSteps().findIndex(s => s.active) 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-200 text-gray-600'
                        }`}
                    >
                      {index + 1}
                    </div>
                    <span className="text-xs mt-1 text-center max-w-[80px]">{step.name}</span>
                  </div>
                ))}
              </div>
              {/* Progress line */}
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 -z-10">
                <div 
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{ 
                    width: `${(getProgressSteps().findIndex(s => s.active) + 1) / getProgressSteps().length * 100}%` 
                  }}
                />
              </div>
            </div>
          )}

          {/* Info message */}
          {isGenerating && status.includes('Summarizing') && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> Large documents are being intelligently summarized to extract key information. 
                This helps create more focused and relevant RFI/RFP content while managing AI processing limits.
              </p>
            </div>
          )}
          
          {/* Developer tip */}
          {isGenerating && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mt-2">
              <p className="text-xs text-gray-700">
                <strong>Tip:</strong> Open your browser's developer console (F12) to see detailed progress logs including document summarization steps.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}