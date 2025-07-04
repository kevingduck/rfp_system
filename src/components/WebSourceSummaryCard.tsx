import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Sparkles, Globe, Loader2, ExternalLink } from 'lucide-react';

interface WebSourceSummaryCardProps {
  source: {
    id: string;
    url: string;
    title: string;
    content: string;
    scrapedAt?: string;
    metadata?: {
      summary_cache?: string;
    };
  };
  projectId: string;
}

export function WebSourceSummaryCard({ source, projectId }: WebSourceSummaryCardProps) {
  const [showFullContent, setShowFullContent] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  useEffect(() => {
    // Load cached summary if available
    if (source.metadata?.summary_cache) {
      try {
        const cached = typeof source.metadata.summary_cache === 'string' 
          ? JSON.parse(source.metadata.summary_cache) 
          : source.metadata.summary_cache;
        setSummary(cached);
      } catch (e) {
        console.error('Failed to parse summary cache:', e);
      }
    }
  }, [source]);

  const generateSummary = async () => {
    if (summary || isGeneratingSummary) return;
    
    setIsGeneratingSummary(true);
    try {
      // For now, we'll need to create a similar endpoint for web sources
      // or modify the existing one to handle both documents and sources
      console.log('Summary generation for web sources not yet implemented');
      // TODO: Implement web source summary endpoint
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
              disabled={isGeneratingSummary || true} // Disabled until implemented
              title="Summary generation for web sources coming soon"
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
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-start mb-2">
            <Sparkles className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
            <div className="flex-1">
              <h5 className="font-medium text-sm text-green-900 mb-1">AI Summary</h5>
              <p className="text-sm text-green-800">{summary.summary || summary.fullSummary}</p>
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
                  <span className="text-green-500 mr-2">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center mb-1">
            <Globe className="h-5 w-5 text-gray-500 mr-2" />
            <h4 className="font-semibold text-sm">{source.title}</h4>
          </div>
          <a 
            href={source.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
          >
            {source.url}
            <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </div>
        {source.scrapedAt && (
          <span className="text-xs text-gray-500">
            Scraped {new Date(source.scrapedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Summary Section */}
      {renderSummary()}

      {/* Toggle for Full Content */}
      {source.content && (
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
              <h5 className="font-medium text-sm text-gray-700 mb-2">Original Web Content</h5>
              <pre className="whitespace-pre-wrap text-xs text-gray-600 font-mono">
                {source.content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Source Stats */}
      <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-gray-500">
        <span>{source.content ? `${source.content.length.toLocaleString()} characters` : 'No content'}</span>
      </div>
    </div>
  );
}