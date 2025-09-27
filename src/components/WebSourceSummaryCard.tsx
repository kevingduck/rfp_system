import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, Sparkles, Globe, Loader2, ExternalLink, Eye, Edit3, Save, X, Building2, GraduationCap, Landmark, Newspaper, Info } from 'lucide-react';

interface ExtractedData {
  siteType?: 'business' | 'government' | 'educational' | 'news' | 'other';
  keyInformation?: any;
  extractedData?: {
    companyInfo?: {
      name?: string;
      description?: string;
      services?: string[];
      products?: string[];
      locations?: string[];
      contact?: {
        email?: string;
        phone?: string;
        address?: string;
      };
      certifications?: string[];
      experience?: string;
      clients?: string[];
    };
    technicalSpecs?: {
      capabilities?: string[];
      technologies?: string[];
      integrations?: string[];
    };
    pricing?: {
      models?: string[];
      tiers?: string[];
      estimates?: string[];
    };
  };
  relevantSections?: Array<{
    title: string;
    content: string;
    relevance: string;
  }>;
  sources?: string[];
  extractedAt?: string;
}

interface WebSourceSummaryCardProps {
  source: {
    id: string;
    url: string;
    title: string;
    content: string;
    scrapedAt?: string;
    metadata?: ExtractedData & {
      summary_cache?: string;
    };
  };
  projectId: string;
}

export function WebSourceSummaryCard({ source, projectId }: WebSourceSummaryCardProps) {
  const [showFullContent, setShowFullContent] = useState(false);
  const [showExtractedData, setShowExtractedData] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(source.content);
  const [editedTitle, setEditedTitle] = useState(source.title);
  const [editedMetadata, setEditedMetadata] = useState(source.metadata || {});
  const [isSaving, setIsSaving] = useState(false);
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
      const response = await fetch(`/api/projects/${projectId}/sources/${source.id}/summarize`, {
        method: 'POST'
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/sources/${source.id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editedContent,
          title: editedTitle,
          metadata: editedMetadata
        })
      });

      if (response.ok) {
        // Update the source object locally
        source.content = editedContent;
        source.title = editedTitle;
        source.metadata = editedMetadata;
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(source.content);
    setEditedTitle(source.title);
    setEditedMetadata(source.metadata || {});
    setIsEditing(false);
  };

  const getSiteTypeIcon = () => {
    switch (source.metadata?.siteType) {
      case 'business':
        return <Building2 className="h-5 w-5 text-blue-500" />;
      case 'government':
        return <Landmark className="h-5 w-5 text-gray-600" />;
      case 'educational':
        return <GraduationCap className="h-5 w-5 text-purple-500" />;
      case 'news':
        return <Newspaper className="h-5 w-5 text-orange-500" />;
      default:
        return <Globe className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSiteTypeLabel = () => {
    switch (source.metadata?.siteType) {
      case 'business':
        return 'Business';
      case 'government':
        return 'Government';
      case 'educational':
        return 'Educational';
      case 'news':
        return 'News';
      default:
        return 'Website';
    }
  };

  const renderExtractedData = () => {
    if (!source.metadata?.extractedData) return null;

    const { companyInfo, technicalSpecs, pricing } = source.metadata.extractedData;

    return (
      <div className="space-y-4">
        {companyInfo && (
          <div>
            <h5 className="font-medium text-sm text-gray-700 mb-2">Company Information</h5>
            <div className="space-y-2 text-sm">
              {companyInfo.name && (
                <div><span className="font-medium">Name:</span> {companyInfo.name}</div>
              )}
              {companyInfo.description && (
                <div><span className="font-medium">Description:</span> {companyInfo.description}</div>
              )}
              {companyInfo.services && companyInfo.services.length > 0 && (
                <div>
                  <span className="font-medium">Services:</span>
                  <ul className="ml-4 mt-1">
                    {companyInfo.services.map((service, idx) => (
                      <li key={idx} className="text-gray-600">• {service}</li>
                    ))}
                  </ul>
                </div>
              )}
              {companyInfo.certifications && companyInfo.certifications.length > 0 && (
                <div>
                  <span className="font-medium">Certifications:</span>
                  <ul className="ml-4 mt-1">
                    {companyInfo.certifications.map((cert, idx) => (
                      <li key={idx} className="text-gray-600">• {cert}</li>
                    ))}
                  </ul>
                </div>
              )}
              {companyInfo.contact && (
                <div>
                  <span className="font-medium">Contact:</span>
                  <div className="ml-4 mt-1 text-gray-600">
                    {companyInfo.contact.email && <div>Email: {companyInfo.contact.email}</div>}
                    {companyInfo.contact.phone && <div>Phone: {companyInfo.contact.phone}</div>}
                    {companyInfo.contact.address && <div>Address: {companyInfo.contact.address}</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {technicalSpecs && (
          <div>
            <h5 className="font-medium text-sm text-gray-700 mb-2">Technical Capabilities</h5>
            <div className="space-y-2 text-sm">
              {technicalSpecs.capabilities && technicalSpecs.capabilities.length > 0 && (
                <div>
                  <span className="font-medium">Capabilities:</span>
                  <ul className="ml-4 mt-1">
                    {technicalSpecs.capabilities.map((cap, idx) => (
                      <li key={idx} className="text-gray-600">• {cap}</li>
                    ))}
                  </ul>
                </div>
              )}
              {technicalSpecs.technologies && technicalSpecs.technologies.length > 0 && (
                <div>
                  <span className="font-medium">Technologies:</span>
                  <ul className="ml-4 mt-1">
                    {technicalSpecs.technologies.map((tech, idx) => (
                      <li key={idx} className="text-gray-600">• {tech}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {source.metadata?.relevantSections && source.metadata.relevantSections.length > 0 && (
          <div>
            <h5 className="font-medium text-sm text-gray-700 mb-2">Relevant Sections</h5>
            <div className="space-y-3">
              {source.metadata.relevantSections.map((section, idx) => (
                <div key={idx} className="border-l-2 border-blue-200 pl-3">
                  <h6 className="font-medium text-sm text-gray-800">{section.title}</h6>
                  <p className="text-sm text-gray-600 mt-1">{section.content}</p>
                  <p className="text-xs text-gray-500 mt-1 italic">{section.relevance}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
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
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-start mb-2">
            <Sparkles className="h-5 w-5 text-green-600 mr-2 mt-0.5" />
            <div className="flex-1">
              <h5 className="font-medium text-sm text-green-900 mb-1">AI Summary</h5>
              <p className="text-sm text-green-800">{summary.summary || summary.fullSummary}</p>
            </div>
          </div>
        </div>

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
            {getSiteTypeIcon()}
            {isEditing ? (
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="ml-2 h-7"
              />
            ) : (
              <>
                <h4 className="font-semibold text-sm ml-2">{source.title}</h4>
                <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                  {getSiteTypeLabel()}
                </span>
              </>
            )}
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
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExtractedData(!showExtractedData)}
                title="View extracted data"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                title="Edit content"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                title="Save changes"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
          {source.metadata?.extractedAt && (
            <span className="text-xs text-gray-500">
              Extracted {new Date(source.metadata.extractedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Summary Section */}
      {!isEditing && renderSummary()}

      {/* Extracted Data Section */}
      {showExtractedData && !isEditing && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center mb-3">
            <Info className="h-5 w-5 text-blue-600 mr-2" />
            <h4 className="font-medium text-sm text-blue-900">Extracted Information</h4>
          </div>
          {renderExtractedData()}
          {source.metadata?.sources && source.metadata.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs text-blue-700">
                Analyzed {source.metadata.sources.length} pages from {source.url}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit Mode */}
      {isEditing && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Content
            </label>
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="w-full h-64 font-mono text-sm"
              placeholder="Enter the content extracted from this web source..."
            />
          </div>
          <p className="text-xs text-gray-500">
            Edit the content above to refine the extracted information. This will be used in your RFP/RFI generation.
          </p>
        </div>
      )}

      {/* Toggle for Full Content */}
      {!isEditing && source.content && (
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
                Hide Full Content
              </>
            ) : (
              <>
                <ChevronDown className="mr-2 h-4 w-4" />
                Show Full Content
              </>
            )}
          </Button>

          {showFullContent && (
            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-md p-4 max-h-96 overflow-y-auto">
              <h5 className="font-medium text-sm text-gray-700 mb-2">Full Extracted Content</h5>
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
        {source.metadata?.siteType && (
          <span>Type: {getSiteTypeLabel()}</span>
        )}
      </div>
    </div>
  );
}