import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Sparkles, FileText, Loader2 } from 'lucide-react';

interface DocumentSummaryCardProps {
  document: {
    id: string;
    filename: string;
    file_type?: string;
    metadata?: any;
    summary_cache?: any;
    extractedInfo?: any;
    content?: string;
  };
  projectId: string;
}

export function DocumentSummaryCard({ document, projectId }: DocumentSummaryCardProps) {
  const [showFullContent, setShowFullContent] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [fullContent, setFullContent] = useState<string>('');

  useEffect(() => {
    // Load cached summary if available
    if (document.summary_cache) {
      try {
        const cached = typeof document.summary_cache === 'string' 
          ? JSON.parse(document.summary_cache) 
          : document.summary_cache;
        setSummary(cached);
      } catch (e) {
        console.error('Failed to parse summary cache:', e);
      }
    }
    
    // Set full content from extractedInfo or content
    if (document.extractedInfo?.text) {
      setFullContent(document.extractedInfo.text);
    } else if (document.content) {
      setFullContent(document.content);
    }
  }, [document]);

  const generateSummary = async () => {
    if (summary || isGeneratingSummary) return;
    
    setIsGeneratingSummary(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/documents/${document.id}/summarize`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const renderSummary = () => {
    if (!summary) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Sparkles className="h-5 w-5 text-amber-600 mr-2" />
              <p className="text-sm text-amber-800">No AI summary available yet</p>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={generateSummary}
              disabled={isGeneratingSummary}
            >
              {isGeneratingSummary ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Summary
                </>
              )}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Main Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-start mb-2">
            <Sparkles className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
            <div className="flex-1">
              <h5 className="font-medium text-sm text-blue-900 mb-1">AI Summary</h5>
              <p className="text-sm text-blue-800">{summary.summary || summary.fullSummary}</p>
            </div>
          </div>
        </div>

        {/* Key Points */}
        {summary.keyPoints && summary.keyPoints.length > 0 && (
          <div>
            <h5 className="font-medium text-sm text-gray-700 mb-2">Key Points</h5>
            <ul className="space-y-1">
              {summary.keyPoints.map((point: string, idx: number) => (
                <li key={idx} className="text-sm text-gray-600 flex items-start">
                  <span className="text-blue-500 mr-2">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Extracted Data */}
        {summary.extractedData && Object.keys(summary.extractedData).length > 0 && (
          <div>
            <h5 className="font-medium text-sm text-gray-700 mb-2">Extracted Information</h5>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(summary.extractedData).map(([key, value]) => {
                if (!value || (Array.isArray(value) && value.length === 0)) return null;
                
                const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                
                return (
                  <div key={key} className="bg-gray-50 rounded-md p-2">
                    <h6 className="font-medium text-xs text-gray-600 mb-1">{label}</h6>
                    {Array.isArray(value) ? (
                      <ul className="text-sm text-gray-700">
                        {value.slice(0, 3).map((item, idx) => (
                          <li key={idx} className="text-xs">• {item}</li>
                        ))}
                        {value.length > 3 && (
                          <li className="text-xs text-gray-500">• ...and {value.length - 3} more</li>
                        )}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-700">{String(value)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          <FileText className="h-5 w-5 text-gray-500 mr-2" />
          <h4 className="font-semibold text-sm">
            {document.filename}
            {document.metadata?.sheetCount && (
              <span className="text-gray-500 ml-2 font-normal">({document.metadata.sheetCount} sheets)</span>
            )}
          </h4>
        </div>
        <span className="text-xs text-gray-500">
          {document.file_type || 'Document'}
        </span>
      </div>

      {/* Summary Section */}
      {renderSummary()}

      {/* Toggle for Full Content */}
      {fullContent && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFullContent(!showFullContent)}
            className="w-full"
          >
            {showFullContent ? (
              <>
                <ChevronUp className="mr-2 h-4 w-4" />
                Hide Original Content
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Show Original Content
              </>
            )}
          </Button>

          {showFullContent && (
            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-md p-4 max-h-96 overflow-y-auto">
              <h5 className="font-medium text-sm text-gray-700 mb-2">Original Document Content</h5>
              <pre className="whitespace-pre-wrap text-xs text-gray-600 font-mono">
                {fullContent}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Document Stats */}
      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-gray-500">
        <span>{fullContent ? `${fullContent.length.toLocaleString()} characters` : 'No content'}</span>
        {summary && summary.chunkCount > 1 && (
          <span>Processed in {summary.chunkCount} chunks</span>
        )}
      </div>
    </div>
  );
}