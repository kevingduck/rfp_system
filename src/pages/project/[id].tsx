import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, Globe, Download, Loader2, FileCheck, Link as LinkIcon, Settings, X, Wand2, Eye, Trash2 } from 'lucide-react';
import { GenerationStatus } from '@/components/GenerationStatus';
import { RFPWizard } from '@/components/RFPWizard';
import { WelcomeCard } from '@/components/WelcomeCard';
import { DraftPreview } from '@/components/DraftPreview';

interface Document {
  id: string;
  filename: string;
  file_type?: string;
  extractedInfo?: any;
  metadata?: any;
}

interface WebSource {
  id: string;
  url: string;
  title: string;
  content: string;
  scrapedAt: string;
  metadata?: {
    summary_cache?: string;
  };
}

interface Project {
  id: string;
  name: string;
  project_type: 'RFI' | 'RFP';
  organization_name?: string;
  status: string;
}

export default function ProjectPage() {
  const router = useRouter();
  const { id } = router.query;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [webSources, setWebSources] = useState<WebSource[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [urlInput, setUrlInput] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [chatContext, setChatContext] = useState<any>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [draftData, setDraftData] = useState<any>(null);
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  
  useEffect(() => {
    if (id) {
      fetchProject();
      fetchDocuments();
      fetchWebSources();
    }
  }, [id]);
  
  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        // Fetch draft after project is loaded
        fetchExistingDraft(data);
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
    }
  };
  
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };
  
  const fetchWebSources = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/sources`);
      if (res.ok) {
        const data = await res.json();
        setWebSources(data);
      }
    } catch (error) {
      console.error('Failed to fetch web sources:', error);
    }
  };
  
  const fetchExistingDraft = async (projectData?: Project) => {
    try {
      const res = await fetch(`/api/projects/${id}/draft`);
      if (res.ok) {
        const draft = await res.json();
        console.log('[Project] Found existing draft:', draft);
        
        // Use provided project data or current state
        const proj = projectData || project;
        
        // Reconstruct the draft data in the expected format
        const reconstructedDraft = {
          projectId: draft.projectId,
          projectName: proj?.name || '',
          projectType: proj?.project_type || 'RFP',
          organizationName: proj?.organization_name || '',
          generatedAt: draft.createdAt,
          sections: draft.sections,
          metadata: draft.metadata
        };
        
        setDraftData(reconstructedDraft);
      }
    } catch (error) {
      console.error('Failed to fetch existing draft:', error);
    }
  };
  
  const deleteDraft = async () => {
    if (!id || !confirm('Are you sure you want to delete the current draft?')) return;
    
    try {
      const res = await fetch(`/api/projects/${id}/draft`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        setDraftData(null);
        setShowDraftPreview(false);
      }
    } catch (error) {
      console.error('Failed to delete draft:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', id as string);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const doc = await res.json();
        setDocuments([...documents, doc]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleWebScrape = async () => {
    if (!urlInput || !id) return;

    setIsScraping(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: urlInput,
          projectId: id,
        }),
      });

      if (res.ok) {
        const source = await res.json();
        setWebSources([...webSources, source]);
        setUrlInput('');
      }
    } catch (error) {
      console.error('Scraping failed:', error);
    } finally {
      setIsScraping(false);
    }
  };
  
  const deleteDocument = async (documentId: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        setDocuments(documents.filter(doc => doc.id !== documentId));
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };
  
  const deleteWebSource = async (sourceId: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/sources/${sourceId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        setWebSources(webSources.filter(source => source.id !== sourceId));
      }
    } catch (error) {
      console.error('Failed to delete web source:', error);
    }
  };

  const generateDocument = async (wizardContext?: any) => {
    if (!id || !project) return;

    setIsGenerating(true);
    setGenerationStatus('Collecting resources...');
    
    try {
      // Use the streaming response method directly
      await generateDocumentFallback(wizardContext);
    } catch (error) {
      console.error('Generation failed:', error);
      setGenerationStatus('Generation failed - check console for details');
      setTimeout(() => setGenerationStatus(''), 5000);
      setIsGenerating(false);
    }
  };
  
  // Fallback method if SSE doesn't work
  const generateDocumentFallback = async (wizardContext?: any) => {
    try {
      const res = await fetch(`/api/projects/${id}/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatContext: wizardContext || chatContext })
      });
      
      if (res.ok) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (line.trim() && line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  // Log for debugging
                  console.log('[SSE] Received:', data);
                  
                  // Also log the status to make it visible
                  if (data.message) {
                    console.log(`[Generation Progress] ${data.message}${data.progress ? ` (${data.progress}%)` : ''}`);
                  }
                  
                  if (data.message) {
                    setGenerationStatus(data.message);
                  }
                  
                  if (data.type === 'complete' && data.draft) {
                    setDraftData(data.draft);
                    setShowDraftPreview(true);
                    setIsGenerating(false);
                    setShowWizard(false);
                    setGenerationStatus('Draft generated successfully!');
                  }
                  
                  if (data.error) {
                    console.error('[SSE] Error:', data.error);
                    setGenerationStatus(`Error: ${data.error}`);
                    setIsGenerating(false);
                  }
                } catch (e) {
                  console.error('[SSE] Parse error:', e, 'Line:', line);
                }
              }
            }
          }
          
          // Process any remaining data in buffer
          if (buffer.trim() && buffer.startsWith('data: ')) {
            try {
              const data = JSON.parse(buffer.slice(6));
              if (data.message) setGenerationStatus(data.message);
            } catch (e) {
              console.error('[SSE] Final buffer parse error:', e);
            }
          }
        }
      } else {
        throw new Error(`Generation failed: ${res.status} ${res.statusText}`);
      }
    } catch (error) {
      console.error('Fallback generation failed:', error);
      setGenerationStatus('Generation failed - check console for details');
      setIsGenerating(false);
    }
  };

  const handleWizardGenerate = (context: any) => {
    setChatContext(context);
    generateDocument(context);
  };
  
  const handleDraftExport = async (includeCitations: boolean) => {
    if (!draftData || !id || !project) return;
    
    try {
      // Generate the final document
      const endpoint = project.project_type === 'RFI' 
        ? `/api/projects/${id}/generate-rfi`
        : `/api/projects/${id}/generate`;
        
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatContext: draftData.metadata?.chatContext,
          includeCitations,
          fromDraft: true,
          draftSections: draftData.sections
        })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.project_type}_${id}${includeCitations ? '_draft' : '_final'}.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Check if we should show welcome (no documents and not in wizard mode)
  const shouldShowWelcome = showWelcome && documents.length === 0 && webSources.length === 0 && !showWizard;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Show welcome card if appropriate */}
        {shouldShowWelcome ? (
          <>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {project ? `${project.project_type} Project: ${project.name}` : 'Loading...'}
              </h1>
              <p className="text-gray-600">
                Let's get started creating your {project?.project_type}
              </p>
            </div>
            <WelcomeCard
              projectType={project?.project_type || 'RFP'}
              onChooseWizard={() => {
                setShowWizard(true);
                setShowWelcome(false);
              }}
              onChooseQuick={() => {
                setShowWelcome(false);
              }}
            />
          </>
        ) : showWizard ? (
          <>
            <div className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {project ? `${project.project_type} Generation Wizard` : 'Loading...'}
                </h1>
                <p className="text-gray-600">
                  Follow the guided steps to create your {project?.project_type}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowWizard(false)}
              >
                Exit Wizard
              </Button>
            </div>
            
            <RFPWizard
              projectId={id as string}
              projectType={project?.project_type || 'RFP'}
              documents={documents}
              webSources={webSources}
              onDocumentUpload={handleFileUpload}
              onWebSourceAdd={async (url: string) => {
                setUrlInput(url);
                await handleWebScrape();
              }}
              onGenerate={handleWizardGenerate}
              isGenerating={isGenerating}
            />
            
            {/* Generation Status */}
            {isGenerating && (
              <GenerationStatus 
                isGenerating={isGenerating}
                status={generationStatus}
                documents={documents.length}
                webSources={webSources.length}
              />
            )}
          </>
        ) : (
          /* Traditional interface */
          <>
            <div className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {project ? `${project.project_type} Project: ${project.name}` : 'Loading...'}
                </h1>
                <p className="text-gray-600">
                  {project?.project_type === 'RFI' 
                    ? 'Gather market information and vendor capabilities'
                    : 'Upload documents and web sources to build your RFP'}
                </p>
                {draftData && (
                  <p className="text-sm text-green-600 mt-1">
                    ✓ Draft saved - Generated {new Date(draftData.generatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {project?.project_type === 'RFI' && (
                  <Link href={`/project/${id}/questions`}>
                    <Button variant="outline" size="lg">
                      <Settings className="mr-2 h-5 w-5" />
                      Manage Questions
                    </Button>
                  </Link>
                )}
                
                {draftData && (
                  <>
                    <Button
                      onClick={() => setShowDraftPreview(true)}
                      variant="outline"
                      size="lg"
                    >
                      <Eye className="mr-2 h-5 w-5" />
                      View Draft
                    </Button>
                    
                    <Button
                      onClick={deleteDraft}
                      variant="outline"
                      size="lg"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="mr-2 h-5 w-5" />
                      Delete Draft
                    </Button>
                  </>
                )}
                
                <Button
                  onClick={() => setShowWizard(true)}
                  variant="outline"
                  size="lg"
                  disabled={!project}
                >
                  <Wand2 className="mr-2 h-5 w-5" />
                  Use Wizard
                </Button>
                
                <Button 
                  onClick={() => generateDocument()} 
                  disabled={isGenerating || !project || (documents.length === 0 && webSources.length === 0)}
                  size="lg"
                >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-5 w-5" />
                    {draftData ? 'Regenerate' : 'Quick Generate'}
                  </>
                )}
                </Button>
              </div>
            </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="mr-2 h-5 w-5" />
                  Document Upload
                </CardTitle>
                <CardDescription>
                  {project?.project_type === 'RFI' 
                    ? 'Upload market research, vendor lists, spreadsheets, and reference documents'
                    : 'Upload RFP documents, requirements, specifications, and pricing spreadsheets'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.xlsm"
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" disabled={isUploading} asChild>
                    <span>
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Choose File
                        </>
                      )}
                    </span>
                  </Button>
                </label>
                
                <div className="mt-4 space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded group">
                      <div className="flex items-center">
                        <FileCheck className="mr-2 h-4 w-4 text-green-600" />
                        <span className="text-sm">{doc.filename}</span>
                      </div>
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete document"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="mr-2 h-5 w-5" />
                  Web Sources
                </CardTitle>
                <CardDescription>
                  {project?.project_type === 'RFI'
                    ? 'Add vendor websites and industry resources'
                    : 'Add web pages with relevant RFP information'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/rfp-requirements"
                    className="flex-1 px-3 py-2 border rounded-md"
                  />
                  <Button onClick={handleWebScrape} disabled={isScraping || !urlInput}>
                    {isScraping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Add'
                    )}
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {webSources.map((source) => (
                    <div key={source.id} className="p-2 bg-gray-50 rounded group">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start flex-1">
                          <LinkIcon className="mr-2 h-4 w-4 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{source.title}</p>
                            <p className="text-xs text-gray-500">{source.url}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteWebSource(source.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors ml-2"
                          title="Delete source"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Generation Status */}
        <GenerationStatus 
          isGenerating={isGenerating}
          status={generationStatus}
          documents={documents.length}
          webSources={webSources.length}
        />

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>{project?.project_type || 'Document'} Content Preview</CardTitle>
              <CardDescription>AI-extracted information from your documents</CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length > 0 ? (
                <div className="space-y-6">
                  {documents.map((doc, index) => (
                    <div key={doc.id} className="border-b pb-4 last:border-0">
                      <h4 className="font-semibold text-sm mb-2">
                        {doc.filename}
                        {doc.metadata?.sheetCount && (
                          <span className="text-gray-500 ml-2">({doc.metadata.sheetCount} sheets)</span>
                        )}
                      </h4>
                      
                      {/* Display extracted sections */}
                      {doc.extractedInfo && (
                        <div className="space-y-3">
                          {doc.extractedInfo.scope && (
                            <div>
                              <h5 className="font-medium text-sm text-gray-700">Scope:</h5>
                              <p className="text-sm text-gray-600">{doc.extractedInfo.scope}</p>
                            </div>
                          )}
                          {doc.extractedInfo.requirements && (
                            <div>
                              <h5 className="font-medium text-sm text-gray-700">Requirements:</h5>
                              <p className="text-sm text-gray-600">{doc.extractedInfo.requirements}</p>
                            </div>
                          )}
                          {doc.extractedInfo.timeline && (
                            <div>
                              <h5 className="font-medium text-sm text-gray-700">Timeline:</h5>
                              <p className="text-sm text-gray-600">{doc.extractedInfo.timeline}</p>
                            </div>
                          )}
                          {doc.extractedInfo.budget && (
                            <div>
                              <h5 className="font-medium text-sm text-gray-700">Budget:</h5>
                              <p className="text-sm text-gray-600">{doc.extractedInfo.budget}</p>
                            </div>
                          )}
                          {doc.extractedInfo.deliverables && (
                            <div>
                              <h5 className="font-medium text-sm text-gray-700">Deliverables:</h5>
                              <p className="text-sm text-gray-600">{doc.extractedInfo.deliverables}</p>
                            </div>
                          )}
                          
                          {/* Show raw text preview for Excel files */}
                          {doc.file_type === '.xlsx' || doc.file_type === '.xls' || doc.file_type === '.xlsm' ? (
                            <div>
                              <h5 className="font-medium text-sm text-gray-700">Spreadsheet Content Preview:</h5>
                              <div className="bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto max-h-60 overflow-y-auto">
                                <pre className="whitespace-pre-wrap">
                                  {doc.extractedInfo.text ? 
                                    doc.extractedInfo.text.substring(0, 1000) + 
                                    (doc.extractedInfo.text.length > 1000 ? '...' : '') 
                                    : 'No content extracted'}
                                </pre>
                              </div>
                            </div>
                          ) : (
                            /* Show text preview for other documents */
                            doc.extractedInfo.text && (
                              <div>
                                <h5 className="font-medium text-sm text-gray-700">Content Preview:</h5>
                                <p className="text-sm text-gray-600">
                                  {doc.extractedInfo.text.substring(0, 300)}
                                  {doc.extractedInfo.text.length > 300 && '...'}
                                </p>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Upload documents or add web sources to see extracted content</p>
              )}
            </CardContent>
          </Card>
        </div>
        </>
        )}
        
        {/* Draft Preview Modal */}
        {showDraftPreview && draftData && (
          <DraftPreview
            draft={draftData}
            onClose={() => {
              setShowDraftPreview(false);
              setDraftData(null);
            }}
            onExport={handleDraftExport}
          />
        )}
      </div>
    </div>
  );
}