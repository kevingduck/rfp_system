import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Download, 
  Edit3, 
  Eye, 
  EyeOff, 
  Save, 
  X,
  Quote,
  CheckCircle,
  History,
  RotateCcw
} from 'lucide-react';
import { VersionHistory } from './VersionHistory';

interface DraftSection {
  title: string;
  content: string;
}

interface DraftData {
  projectId: string;
  projectName: string;
  projectType: 'RFI' | 'RFP';
  organizationName: string;
  generatedAt: string;
  sections: Record<string, string>;
  metadata: {
    documentsUsed: Array<{ id: string; filename: string }>;
    webSourcesUsed: Array<{ id: string; url: string; title: string }>;
    knowledgeBaseUsed: Array<{ category: string; count: number }>;
    chatContext: any;
  };
}

interface DraftRevision {
  id: string;
  draftId: string;
  projectId: string;
  versionNumber: number;
  content: Record<string, string>;
  metadata: any;
  createdAt: string;
  createdBy: string | null;
}

interface DraftPreviewProps {
  draft: DraftData;
  onClose: () => void;
  onExport: (includeCitations: boolean) => void;
}

export function DraftPreview({ draft, onClose, onExport }: DraftPreviewProps) {
  const [showCitations, setShowCitations] = useState(true);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Initialize edited content with original content
  useEffect(() => {
    const initialContent: Record<string, string> = {};
    Object.entries(draft.sections).forEach(([key, content]) => {
      initialContent[key] = content;
    });
    setEditedContent(initialContent);
  }, [draft.sections]);

  const handleRestoreRevision = async (revision: DraftRevision) => {
    try {
      const response = await fetch(`/api/projects/${draft.projectId}/draft/revisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionId: revision.id }),
      });
      
      if (response.ok) {
        // Reload the page to get the restored content
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to restore revision:', error);
    }
  };


  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${draft.projectId}/draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sections: editedContent,
          metadata: draft.metadata 
        }),
      });
      
      if (response.ok) {
        setEditingSection(null);
        // Update the draft prop with the edited content
        Object.assign(draft.sections, editedContent);
      }
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatContent = (content: string) => {
    if (!showCitations) {
      // Remove citations for clean view
      return content.replace(/\[Source:[^\]]+\]/g, '');
    }
    
    // Highlight citations
    return content.replace(
      /\[Source:([^\]]+)\]/g,
      '<span class="citation" title="$1">[Source:$1]</span>'
    );
  };

  const extractCitations = (content: string): string[] => {
    const citations = content.match(/\[Source:[^\]]+\]/g) || [];
    return [...new Set(citations)];
  };

  const getSectionTitle = (key: string): string => {
    return key.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 my-8">
        <Card className="bg-white">
          <CardHeader className="border-b">
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl mb-2">
                  {draft.projectType} Draft Preview
                </CardTitle>
                <p className="text-sm text-gray-600">
                  {draft.projectName} for {draft.organizationName}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Generated: {new Date(draft.generatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCitations(!showCitations)}
                >
                  {showCitations ? (
                    <>
                      <EyeOff className="h-4 w-4 mr-2" />
                      Hide Citations
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Show Citations
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    console.log('Version History clicked, current state:', showVersionHistory);
                    setShowVersionHistory(!showVersionHistory);
                  }}
                >
                  <History className="h-4 w-4 mr-2" />
                  Version History
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExport(false)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Clean
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExport(true)}
                >
                  <Quote className="h-4 w-4 mr-2" />
                  Export with Citations
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
          
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Main content area */}
              <div className="col-span-2 space-y-6">
                {Object.entries(editedContent).map(([key, content]) => (
                  <div key={key} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold">
                        {getSectionTitle(key)}
                      </h3>
                      {editingSection !== key && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSection(key)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    {editingSection === key ? (
                      <div className="space-y-3">
                        <textarea
                          value={content}
                          onChange={(e) => setEditedContent({
                            ...editedContent,
                            [key]: e.target.value
                          })}
                          className="w-full h-64 p-3 border rounded-md font-mono text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={isSaving}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingSection(null);
                              setEditedContent({
                                ...editedContent,
                                [key]: draft.sections[key]
                              });
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="prose max-w-none draft-content"
                        dangerouslySetInnerHTML={{ 
                          __html: formatContent(content) 
                        }}
                      />
                    )}
                    
                    {showCitations && (
                      <div className="mt-4 pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-1">
                          Citations in this section:
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {extractCitations(content).map((citation, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded"
                            >
                              {citation}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Sidebar with metadata */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Sources Used</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-1">
                        Documents ({draft.metadata.documentsUsed.length})
                      </h4>
                      <div className="space-y-1">
                        {draft.metadata.documentsUsed.map(doc => (
                          <div key={doc.id} className="text-xs text-gray-700">
                            <FileText className="inline h-3 w-3 mr-1" />
                            {doc.filename}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-1">
                        Web Sources ({draft.metadata.webSourcesUsed.length})
                      </h4>
                      <div className="space-y-1">
                        {draft.metadata.webSourcesUsed.map(source => (
                          <div key={source.id} className="text-xs text-gray-700">
                            🌐 {source.title || source.url}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-1">
                        Knowledge Base
                      </h4>
                      <div className="space-y-1">
                        {draft.metadata.knowledgeBaseUsed.map(kb => (
                          <div key={kb.category} className="text-xs text-gray-700">
                            📚 {kb.category}: {kb.count} files
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Export Options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => onExport(false)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Final Version (No Citations)
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      size="sm"
                      onClick={() => onExport(true)}
                    >
                      <Quote className="h-4 w-4 mr-2" />
                      Draft Version (With Citations)
                    </Button>
                  </CardContent>
                </Card>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">
                    About Citations
                  </h4>
                  <p className="text-xs text-blue-800">
                    Citations show exactly where information comes from. 
                    They're included in the draft for transparency but can be 
                    removed for the final client version.
                  </p>
                </div>

              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <style jsx>{`
        .draft-content :global(.citation) {
          background-color: #fef3c7;
          color: #92400e;
          padding: 0 4px;
          border-radius: 3px;
          font-size: 0.875rem;
          cursor: help;
          text-decoration: underline dotted;
        }
        
        .draft-content :global(.citation:hover) {
          background-color: #fde68a;
        }
      `}</style>
      
      {/* Version History Modal */}
      {showVersionHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] overflow-y-auto">
          <div className="max-w-4xl mx-auto p-4 my-8">
            <div className="bg-white rounded-lg shadow-xl">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-semibold">Version History</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVersionHistory(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4">
                <VersionHistory
                  projectId={draft.projectId}
                  currentContent={editedContent}
                  onRestore={handleRestoreRevision}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}