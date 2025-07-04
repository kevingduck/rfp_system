import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Eye, Sparkles, X, Download, Copy, Check } from 'lucide-react';

interface DocumentData {
  id: string;
  filename: string;
  content?: string;
  metadata?: any;
  summary_cache?: any;
  file_type?: string;
  extractedInfo?: any;
}

interface DocumentViewerProps {
  document: DocumentData;
  onClose: () => void;
}

export function DocumentViewer({ document, onClose }: DocumentViewerProps) {
  const [viewMode, setViewMode] = useState<'full' | 'summary'>('summary');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [fullDocument, setFullDocument] = useState<DocumentData>(document);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

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
    
    // Load full document content if not available
    if (!document.content && viewMode === 'full') {
      loadFullDocument();
    }
  }, [document, viewMode]);

  const loadFullDocument = async () => {
    setIsLoadingContent(true);
    try {
      // Extract project ID from the document metadata or make a separate API call
      const response = await fetch(`/api/documents/${document.id}`);
      if (response.ok) {
        const data = await response.json();
        setFullDocument(data);
      }
    } catch (error) {
      console.error('Failed to load full document:', error);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const generateSummary = async () => {
    if (summary || isGeneratingSummary) return;
    
    setIsGeneratingSummary(true);
    try {
      // We need the project ID - it should be passed or extracted from the document
      const projectId = (window.location.pathname.match(/project\/([^\/]+)/) || [])[1];
      if (!projectId) {
        console.error('Could not determine project ID');
        return;
      }
      
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatContent = (content: string | undefined) => {
    if (!content) return 'No content available';
    // Add basic formatting for better readability
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n\n');
  };

  const renderSummary = () => {
    if (!summary) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No summary available yet</p>
          <Button onClick={generateSummary} disabled={isGeneratingSummary}>
            <Sparkles className="mr-2 h-4 w-4" />
            {isGeneratingSummary ? 'Generating...' : 'Generate Summary'}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Main Summary */}
        <div>
          <h3 className="font-semibold text-lg mb-3">Summary</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{summary.summary}</p>
        </div>

        {/* Key Points */}
        {summary.keyPoints && summary.keyPoints.length > 0 && (
          <div>
            <h3 className="font-semibold text-lg mb-3">Key Points</h3>
            <ul className="list-disc list-inside space-y-2">
              {summary.keyPoints.map((point: string, idx: number) => (
                <li key={idx} className="text-gray-700">{point}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Extracted Data */}
        {summary.extractedData && (
          <div>
            <h3 className="font-semibold text-lg mb-3">Extracted Information</h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(summary.extractedData).map(([key, value]) => {
                if (!value || (Array.isArray(value) && value.length === 0)) return null;
                
                const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
                
                return (
                  <div key={key} className="border rounded-md p-3">
                    <h4 className="font-medium text-sm text-gray-600 mb-1">{label}</h4>
                    {Array.isArray(value) ? (
                      <ul className="text-sm space-y-1">
                        {value.map((item, idx) => (
                          <li key={idx} className="text-gray-700">• {item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-700">{String(value)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Document Stats */}
        <div className="border-t pt-4">
          <p className="text-sm text-gray-500">
            Original document: {(document.content?.length || 0).toLocaleString()} characters
            {summary.chunkCount > 1 && ` • Processed in ${summary.chunkCount} chunks`}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 my-8">
        <Card className="bg-white">
          <CardHeader className="border-b">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-xl mb-2 flex items-center">
                  <FileText className="mr-2 h-5 w-5" />
                  {document.filename}
                </CardTitle>
                <p className="text-sm text-gray-500">
                  {document.file_type || 'Document'} • {(document.content?.length || 0).toLocaleString()} characters
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'summary' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('summary')}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Summary
                </Button>
                <Button
                  variant={viewMode === 'full' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('full')}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Full Text
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(
                    viewMode === 'summary' && summary 
                      ? summary.summary 
                      : document.content || ''
                  )}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 max-h-[70vh] overflow-y-auto">
            {viewMode === 'summary' ? (
              renderSummary()
            ) : (
              <div>
                <h3 className="font-semibold text-lg mb-3">Full Document Text</h3>
                {isLoadingContent ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading document content...</p>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">
                      {formatContent(fullDocument.content || document.extractedInfo?.text)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}