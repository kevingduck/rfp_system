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
import { diffWords } from 'diff';

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
    const diff = diffWords(oldText || '', newText || '');
    
    return (
      <div className="text-sm font-mono bg-gray-50 p-3 rounded-md overflow-x-auto">
        {diff.map((part, index) => {
          if (part.added) {
            return <span key={index} className="bg-green-200 text-green-900">{part.value}</span>;
          } else if (part.removed) {
            return <span key={index} className="bg-red-200 text-red-900 line-through">{part.value}</span>;
          }
          return <span key={index}>{part.value}</span>;
        })}
      </div>
    );
  };

  const getChangedSections = (revision: DraftRevision): string[] => {
    const changedSections: string[] = [];
    
    // Compare with current content
    Object.keys(currentContent).forEach(key => {
      if (revision.content[key] !== currentContent[key]) {
        changedSections.push(key);
      }
    });
    
    // Check for sections that exist in revision but not in current
    Object.keys(revision.content).forEach(key => {
      if (!currentContent[key] && !changedSections.includes(key)) {
        changedSections.push(key);
      }
    });
    
    return changedSections;
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
        
        {revisions.map((revision) => {
          const changedSections = getChangedSections(revision);
          const isExpanded = expandedRevision === revision.id;
          const isComparing = comparingRevision === revision.id;
          
          return (
            <div
              key={revision.id}
              className={`border rounded-lg ${isComparing ? 'border-blue-500' : 'border-gray-200'}`}
            >
              <div className="p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="font-semibold text-sm">Version {revision.versionNumber}</span>
                      {changedSections.length > 0 && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                          {changedSections.length} changes
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
                      onClick={() => {
                        setComparingRevision(isComparing ? null : revision.id);
                        setShowDiff(true);
                      }}
                      title="Compare with current"
                    >
                      <Diff className="h-3 w-3" />
                    </Button>
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
                  <div className="mt-2 text-xs text-gray-600">
                    Changed sections: {changedSections.slice(0, 3).map(s => getSectionTitle(s)).join(', ')}
                    {changedSections.length > 3 && ` +${changedSections.length - 3} more`}
                  </div>
                )}
              </div>
              
              {isExpanded && (
                <div className="border-t px-3 py-3 bg-gray-50">
                  <div className="space-y-3">
                    {changedSections.map(section => (
                      <div key={section} className="bg-white rounded p-3 border">
                        <h4 className="font-semibold text-sm mb-2">{getSectionTitle(section)}</h4>
                        
                        {isComparing && showDiff ? (
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Changes from version {revision.versionNumber} to current:</p>
                            {renderDiff(revision.content[section], currentContent[section])}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-700 max-h-32 overflow-y-auto">
                            {revision.content[section] || <span className="text-gray-400 italic">Section removed</span>}
                          </div>
                        )}
                      </div>
                    ))}
                    
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