import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  History, 
  RotateCcw, 
  Eye, 
  ChevronDown,
  ChevronUp,
  FileText,
  User,
  Calendar,
  Diff
} from 'lucide-react';
import { diffLines, diffWords } from 'diff';

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

interface VersionHistoryProps {
  projectId: string;
  currentContent: Record<string, string>;
  onRestore: (revision: DraftRevision) => void;
}

export function VersionHistory({ projectId, currentContent, onRestore }: VersionHistoryProps) {
  const [revisions, setRevisions] = useState<DraftRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRevision, setExpandedRevision] = useState<string | null>(null);
  const [comparingRevision, setComparingRevision] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    fetchRevisions();
  }, [projectId]);

  const fetchRevisions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/draft/revisions`);
      if (response.ok) {
        const data = await response.json();
        setRevisions(data);
      }
    } catch (error) {
      console.error('Failed to fetch revisions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSectionTitle = (key: string): string => {
    return key.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  };

  const renderDiff = (oldText: string, newText: string) => {
    // Use line diff for better visibility of changes
    const diff = diffLines(oldText || '', newText || '');
    
    return (
      <div className="text-sm bg-gray-50 rounded-md overflow-x-auto">
        {diff.map((part, index) => {
          if (part.added) {
            return (
              <div key={index} className="bg-green-100 border-l-4 border-green-500 p-2 my-1">
                <span className="text-green-700 font-semibold text-xs">+ Added:</span>
                <pre className="text-green-900 whitespace-pre-wrap mt-1">{part.value}</pre>
              </div>
            );
          } else if (part.removed) {
            return (
              <div key={index} className="bg-red-100 border-l-4 border-red-500 p-2 my-1">
                <span className="text-red-700 font-semibold text-xs">- Removed:</span>
                <pre className="text-red-900 whitespace-pre-wrap mt-1 line-through opacity-75">{part.value}</pre>
              </div>
            );
          }
          return (
            <div key={index} className="p-2 my-1">
              <pre className="text-gray-700 whitespace-pre-wrap">{part.value}</pre>
            </div>
          );
        })}
      </div>
    );
  };

  const getChangedSections = (revision: DraftRevision, previousRevision?: DraftRevision): string[] => {
    const changedSections: string[] = [];
    const compareWith = previousRevision?.content || {};
    
    // Compare with previous version (or empty if first version)
    Object.keys(revision.content).forEach(key => {
      if (revision.content[key] !== compareWith[key]) {
        changedSections.push(key);
      }
    });
    
    // Check for sections that were removed
    Object.keys(compareWith).forEach(key => {
      if (!revision.content[key] && !changedSections.includes(key)) {
        changedSections.push(key);
      }
    });
    
    return changedSections;
  };

  const getPreviousRevision = (currentIndex: number): DraftRevision | undefined => {
    // Since revisions are sorted by version_number DESC, the previous version is at index + 1
    return revisions[currentIndex + 1];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-gray-500">Loading version history...</p>
        </CardContent>
      </Card>
    );
  }

  if (revisions.length === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-gray-500">No version history available yet.</p>
          <p className="text-xs text-gray-400 mt-1">Versions are created when you edit and save content.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <History className="h-5 w-5 mr-2" />
          Version History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-gray-600 mb-3">
          Current version: {Math.max(...revisions.map(r => r.versionNumber)) + 1}
        </div>
        
        {revisions.map((revision, index) => {
          const previousRevision = getPreviousRevision(index);
          const changedSections = getChangedSections(revision, previousRevision);
          const isExpanded = expandedRevision === revision.id;
          const isLatest = index === 0;
          
          return (
            <div
              key={revision.id}
              className="border rounded-lg border-gray-200 hover:border-gray-300 transition-colors"
            >
              <div className="p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="font-semibold text-sm">Version {revision.versionNumber}</span>
                      {isLatest && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          Current
                        </span>
                      )}
                      {changedSections.length > 0 && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                          {changedSections.length} {changedSections.length === 1 ? 'change' : 'changes'}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(revision.createdAt).toLocaleString()}
                      </div>
                      {revision.createdBy && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {revision.createdBy}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedRevision(isExpanded ? null : revision.id)}
                      title={isExpanded ? "Hide details" : "Show details"}
                    >
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Restore to version ${revision.versionNumber}? Current changes will be saved as a new version.`)) {
                          onRestore(revision);
                        }
                      }}
                      title="Restore this version"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                {changedSections.length > 0 && !isExpanded && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-600 mb-2">
                      Changed sections: {changedSections.slice(0, 3).map(s => getSectionTitle(s)).join(', ')}
                      {changedSections.length > 3 && ` +${changedSections.length - 3} more`}
                    </div>
                    {/* Show a preview of the first change */}
                    {changedSections.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mt-1">
                        <p className="text-xs font-semibold text-yellow-800 mb-1">
                          Preview: {getSectionTitle(changedSections[0])}
                        </p>
                        <div className="text-xs">
                          {(() => {
                            const section = changedSections[0];
                            const prev = previousRevision?.content[section] || '';
                            const curr = revision.content[section] || '';
                            const diff = diffWords(prev, curr);
                            let changeCount = 0;
                            const maxChanges = 3;
                            
                            return (
                              <div className="line-clamp-3">
                                {diff.map((part, i) => {
                                  if (part.added && changeCount < maxChanges) {
                                    changeCount++;
                                    return <span key={i} className="bg-green-200 px-0.5 rounded">{part.value}</span>;
                                  } else if (part.removed && changeCount < maxChanges) {
                                    changeCount++;
                                    return <span key={i} className="bg-red-200 px-0.5 rounded line-through">{part.value}</span>;
                                  }
                                  return <span key={i}>{part.value.length > 50 ? part.value.substring(0, 50) + '...' : part.value}</span>;
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {isExpanded && (
                <div className="border-t px-3 py-3 bg-gray-50">
                  <div className="space-y-3">
                    {changedSections.map(section => {
                      const previousContent = previousRevision?.content[section] || '';
                      const currentSectionContent = revision.content[section] || '';
                      const wasRemoved = !revision.content[section] && previousRevision?.content[section];
                      
                      return (
                        <div key={section} className="bg-white rounded p-3 border">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-sm">{getSectionTitle(section)}</h4>
                            {wasRemoved && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                Removed
                              </span>
                            )}
                          </div>
                          
                          <div>
                            {previousContent && currentSectionContent && (
                              <>
                                <p className="text-xs text-gray-500 mb-2">
                                  Changes in version {revision.versionNumber}:
                                </p>
                                {renderDiff(previousContent, currentSectionContent)}
                              </>
                            )}
                            {!previousContent && currentSectionContent && (
                              <>
                                <p className="text-xs text-gray-500 mb-2">
                                  New in version {revision.versionNumber}:
                                </p>
                                <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
                                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">{currentSectionContent}</pre>
                                </div>
                              </>
                            )}
                            {wasRemoved && (
                              <>
                                <p className="text-xs text-gray-500 mb-2">
                                  Removed in version {revision.versionNumber}:
                                </p>
                                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                                  <pre className="text-sm text-gray-500 whitespace-pre-wrap line-through">{previousContent}</pre>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    
                    {changedSections.length === 0 && (
                      <p className="text-sm text-gray-500 italic">No changes in this version</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        <div className="pt-3 border-t">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={fetchRevisions}
          >
            <RotateCcw className="h-3 w-3 mr-2" />
            Refresh History
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}