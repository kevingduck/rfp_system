import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Upload, Globe, Download, Loader2, FileCheck, Link as LinkIcon, Settings, X, Wand2, Eye, Trash2, ArrowRight, Check, Sparkles, Save, Edit2, CheckCircle, AlertCircle } from 'lucide-react';
import { GenerationStatus } from '@/components/GenerationStatus';
import { WelcomeCard } from '@/components/WelcomeCard';
import { DraftPreview } from '@/components/DraftPreview';
import { DocumentViewer } from '@/components/DocumentViewer';
import { DocumentSummaryCard } from '@/components/DocumentSummaryCard';
import { WebSourceSummaryCard } from '@/components/WebSourceSummaryCard';

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

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  required: boolean;
  order_index: number;
  category?: string;
  answer?: string;
}

export default function ProjectPage() {
  const router = useRouter();
  const { id } = router.query;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [webSources, setWebSources] = useState<WebSource[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [isScraping, setIsScraping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [urlInput, setUrlInput] = useState('');
  const [chatContext, setChatContext] = useState<any>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [draftData, setDraftData] = useState<any>(null);
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [targetLength, setTargetLength] = useState<number>(20); // Default 20 pages
  
  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isExtractingQuestions, setIsExtractingQuestions] = useState(false);
  const [questionsExtracted, setQuestionsExtracted] = useState(false);
  const [editingAnswers, setEditingAnswers] = useState<Record<string, string>>({});
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [hasRFIDocument, setHasRFIDocument] = useState(false);
  
  useEffect(() => {
    if (id) {
      fetchProject();
      fetchDocuments();
      fetchWebSources();
      fetchQuestions();
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
        // Ensure data is an array
        const docs = Array.isArray(data) ? data : [];
        setDocuments(docs);
        
        // Check if we have an RFI/RFP document
        const hasRFI = docs.some(doc => 
          doc.filename?.toLowerCase().includes('rfi') || 
          doc.filename?.toLowerCase().includes('rfp')
        );
        setHasRFIDocument(hasRFI);
        
        // If we have an RFI document and haven't extracted questions yet, do it automatically
        if (hasRFI && docs.length === 1 && questions.length === 0) {
          await extractQuestions();
        }
      } else {
        console.error('Failed to fetch documents:', res.status);
        setDocuments([]);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      setDocuments([]);
    }
  };
  
  const fetchQuestions = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
        setQuestionsExtracted(data.length > 0);
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    }
  };
  
  const fetchWebSources = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/sources`);
      if (res.ok) {
        const data = await res.json();
        // Ensure data is an array
        setWebSources(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch web sources:', res.status);
        setWebSources([]);
      }
    } catch (error) {
      console.error('Failed to fetch web sources:', error);
      setWebSources([]);
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
    const files = e.target.files;
    if (!files || files.length === 0 || !id) return;

    setIsUploading(true);
    const uploadedDocs: Document[] = [];
    const failedUploads: string[] = [];
    
    // Process files in batches to avoid overload
    const BATCH_SIZE = 3;
    const fileArray = Array.from(files);
    
    // Show initial progress
    setUploadProgress(`Uploading ${fileArray.length} file${fileArray.length > 1 ? 's' : ''}...`);
    
    try {
      for (let i = 0; i < fileArray.length; i += BATCH_SIZE) {
        const batch = fileArray.slice(i, i + BATCH_SIZE);
        const uploadPromises = batch.map(async (file) => {
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
              return { success: true, doc, filename: file.name };
            } else {
              const error = await res.text();
              return { success: false, filename: file.name, error };
            }
          } catch (error) {
            return { success: false, filename: file.name, error: error?.toString() };
          }
        });

        // Update progress
        setUploadProgress(`Uploading files ${i + 1}-${Math.min(i + BATCH_SIZE, fileArray.length)} of ${fileArray.length}...`);
        
        // Wait for batch to complete
        const results = await Promise.all(uploadPromises);
        
        // Process results
        results.forEach(result => {
          if (result.success) {
            uploadedDocs.push(result.doc);
          } else {
            failedUploads.push(result.filename);
          }
        });
        
        // Update documents after each batch
        if (uploadedDocs.length > 0) {
          setDocuments(prev => [...prev, ...uploadedDocs]);
          uploadedDocs.length = 0; // Clear for next batch
        }
      }
      
      // Show results
      if (failedUploads.length > 0) {
        alert(`Upload completed with errors:\n\nSuccessful: ${fileArray.length - failedUploads.length} files\nFailed: ${failedUploads.join(', ')}`);
      } else if (fileArray.length > 1) {
        alert(`Successfully uploaded ${fileArray.length} files`);
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again with fewer files.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
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
  
  const extractQuestions = async () => {
    setIsExtractingQuestions(true);
    try {
      const res = await fetch(`/api/projects/${id}/smart-questions`, {
        method: 'POST',
      });

      if (res.ok) {
        const result = await res.json();
        await fetchQuestions();
        setQuestionsExtracted(true);
      } else {
        const errorData = await res.json();
        console.error('API Error:', errorData);
        alert(errorData.details || 'Failed to extract questions from the RFI/RFP document.');
      }
    } catch (error) {
      console.error('Failed to extract questions:', error);
      alert('Failed to extract questions. Please check your connection and try again.');
    } finally {
      setIsExtractingQuestions(false);
    }
  };
  
  const updateAnswer = async (questionId: string, answer: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/questions/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });

      if (res.ok) {
        await fetchQuestions();
        delete editingAnswers[questionId];
        setEditingAnswers({...editingAnswers});
      }
    } catch (error) {
      console.error('Failed to update answer:', error);
    }
  };
  
  const autoFillAnswers = async () => {
    setIsAutoFilling(true);
    try {
      // Use all documents (including RFI/RFP) for answer generation
      const res = await fetch(`/api/projects/${id}/fill-answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: questions.map(q => ({ id: q.id, text: q.question_text })),
          documents: documents, // Send all documents
          includeCompanyKnowledge: true // Flag to include company knowledge
        }),
      });

      if (res.ok) {
        const result = await res.json();
        await fetchQuestions();
        alert(`Successfully regenerated answers for ${result.answersUpdated} questions using all available documents and company knowledge.`);
      } else {
        const error = await res.json();
        alert(`Failed to regenerate answers: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to auto-fill answers:', error);
      alert('Failed to regenerate answers. Please check your connection and try again.');
    } finally {
      setIsAutoFilling(false);
    }
  };

  const generateDocument = async (wizardContext?: any) => {
    if (!id || !project) return;

    // For RFI projects, ensure all questions have answers
    if (project.project_type === 'RFI' && questions.length > 0) {
      const unansweredQuestions = questions.filter(q => !q.answer);
      if (unansweredQuestions.length > 0) {
        const proceed = confirm(
          `${unansweredQuestions.length} questions don't have answers yet. Generate anyway?`
        );
        if (!proceed) return;
      }
    }

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
        body: JSON.stringify({ 
          chatContext: wizardContext || chatContext,
          targetLength
        })
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

  // Check if we should show welcome (no documents)
  const shouldShowWelcome = showWelcome && documents.length === 0 && webSources.length === 0;

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
                setShowWelcome(false);
              }}
              onChooseQuick={() => {
                setShowWelcome(false);
              }}
            />
          </>
        ) : (
          /* Traditional interface */
          <>
            {/* RFI/RFP Upload Card - Show prominently if no RFI/RFP document uploaded yet */}
            {documents.length === 0 && (
              <Card className="mb-8 border-blue-200 bg-blue-50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl text-blue-900">
                        Step 1: Upload the {project?.project_type} Document You Received
                      </CardTitle>
                      <CardDescription className="text-blue-700 mt-2">
                        This is the document from the client that contains questions and requirements
                      </CardDescription>
                    </div>
                    <FileText className="h-12 w-12 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-white border border-blue-200 rounded-md p-3">
                      <h4 className="font-medium text-sm text-blue-900 mb-2">What happens next:</h4>
                      <ol className="text-sm text-blue-800 space-y-1">
                        <li>1. We'll analyze the document to extract all questions</li>
                        <li>2. Generate initial answers from your company knowledge</li>
                        <li>3. You can review and edit all answers</li>
                        <li>4. Generate your final response document</li>
                      </ol>
                    </div>
                    <div className="flex gap-4">
                      <Button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            {uploadProgress || 'Uploading...'}
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-5 w-5" />
                            Upload {project?.project_type} Document
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Workflow Status Indicator */}
            {documents.length > 0 && project?.project_type === 'RFI' && (
              <Card className="mb-6 bg-gradient-to-r from-gray-50 to-gray-100">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-8">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${documents.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}>
                          {documents.length > 0 ? <Check className="h-5 w-5 text-white" /> : <span className="text-white text-sm">1</span>}
                        </div>
                        <span className="ml-2 text-sm font-medium">RFI Uploaded</span>
                      </div>
                      <div className="h-px w-12 bg-gray-300" />
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${questionsExtracted ? 'bg-green-500' : 'bg-gray-300'}`}>
                          {questionsExtracted ? <Check className="h-5 w-5 text-white" /> : <span className="text-white text-sm">2</span>}
                        </div>
                        <span className="ml-2 text-sm font-medium">Extract Questions</span>
                      </div>
                      <div className="h-px w-12 bg-gray-300" />
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${questions.some(q => q.answer) ? 'bg-green-500' : 'bg-gray-300'}`}>
                          {questions.some(q => q.answer) ? <Check className="h-5 w-5 text-white" /> : <span className="text-white text-sm">3</span>}
                        </div>
                        <span className="ml-2 text-sm font-medium">Answer Questions</span>
                      </div>
                      <div className="h-px w-12 bg-gray-300" />
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${draftData ? 'bg-green-500' : 'bg-gray-300'}`}>
                          {draftData ? <Check className="h-5 w-5 text-white" /> : <span className="text-white text-sm">4</span>}
                        </div>
                        <span className="ml-2 text-sm font-medium">Generate Response</span>
                      </div>
                    </div>
                    {!questionsExtracted && (
                      <Button 
                        size="sm" 
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={extractQuestions}
                        disabled={isExtractingQuestions}
                      >
                        {isExtractingQuestions ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Extract Questions
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {project ? `${project.project_type} Project: ${project.name}` : 'Loading...'}
                </h1>
                <p className="text-gray-600">
                  {project?.project_type === 'RFI' 
                    ? 'Prepare your vendor response to the RFI request'
                    : 'Build your proposal response to the RFP requirements'}
                </p>
                {draftData && (
                  <p className="text-sm text-green-600 mt-1">
                    ✓ Draft saved - Generated {new Date(draftData.generatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
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
                    {draftData ? 'Regenerate' : 'Generate ' + (project?.project_type || '')}
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
                  {questionsExtracted ? 'Supporting Documents' : 'Document Upload'}
                </CardTitle>
                <CardDescription>
                  {documents.length === 0 
                    ? `Upload the ${project?.project_type} document you received`
                    : questionsExtracted 
                      ? 'Upload company info, case studies, certifications to auto-fill answers'
                      : 'Upload additional supporting documents'}
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
                  multiple
                />
                <label htmlFor="file-upload">
                  <Button variant="outline" disabled={isUploading} asChild>
                    <span>
                      {isUploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {uploadProgress || 'Uploading...'}
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Choose Files
                        </>
                      )}
                    </span>
                  </Button>
                </label>
                
                <p className="text-xs text-gray-500 mt-2">
                  You can select multiple files at once (Ctrl/Cmd + Click)
                </p>
                
                <div className="mt-4 space-y-2">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded group">
                      <div className="flex items-center flex-1">
                        <FileCheck className="mr-2 h-4 w-4 text-green-600" />
                        <span className="text-sm">{doc.filename}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedDocument(doc)}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                          title="View document"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete document"
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

        {/* Questions Section - Show after questions are extracted */}
        {project?.project_type === 'RFI' && questionsExtracted && questions.length > 0 && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Extracted Questions & Answers</CardTitle>
                    <CardDescription>
                      Review and edit answers to the questions from the RFI document
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={autoFillAnswers}
                      disabled={isAutoFilling}
                    >
                      {isAutoFilling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Regenerating Answers...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Regenerate Answers from All Sources
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <div key={question.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {index + 1}. {question.question_text}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                          </p>
                          {question.category && (
                            <span className="text-xs text-gray-500 mt-1">Category: {question.category}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Answer section */}
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Answer:</label>
                        {editingAnswers[question.id] !== undefined ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingAnswers[question.id]}
                              onChange={(e) => setEditingAnswers({
                                ...editingAnswers,
                                [question.id]: e.target.value
                              })}
                              className="w-full px-3 py-2 border rounded-md"
                              rows={4}
                              placeholder="Enter your answer..."
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateAnswer(question.id, editingAnswers[question.id])}
                              >
                                <Save className="mr-2 h-4 w-4" />
                                Save Answer
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const newEditing = {...editingAnswers};
                                  delete newEditing[question.id];
                                  setEditingAnswers(newEditing);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white border rounded-md p-3">
                            {question.answer ? (
                              <div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{question.answer}</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="mt-2"
                                  onClick={() => setEditingAnswers({
                                    ...editingAnswers,
                                    [question.id]: question.answer || ''
                                  })}
                                >
                                  <Edit2 className="mr-2 h-4 w-4" />
                                  Edit Answer
                                </Button>
                              </div>
                            ) : (
                              <div>
                                <p className="text-sm text-gray-500 italic">No answer provided yet</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="mt-2"
                                  onClick={() => setEditingAnswers({
                                    ...editingAnswers,
                                    [question.id]: ''
                                  })}
                                >
                                  <Edit2 className="mr-2 h-4 w-4" />
                                  Add Answer
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Info about answer generation */}
                <div className="mt-4 space-y-3">
                  {documents.filter(doc => 
                    !doc.filename?.toLowerCase().includes('rfi') && 
                    !doc.filename?.toLowerCase().includes('rfp')
                  ).length === 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
                        <div>
                          <p className="text-sm text-amber-800">
                            <strong>Tip:</strong> Upload supporting documents (company info, case studies, certifications) for more comprehensive answers.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-start">
                      <Sparkles className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                      <div>
                        <p className="text-sm text-blue-800">
                          <strong>Answer Generation Sources:</strong> Click "Regenerate Answers" anytime to update answers using:
                        </p>
                        <ul className="text-sm text-blue-700 mt-1 ml-4 list-disc">
                          <li>Your company information and settings</li>
                          <li>Company knowledge base documents</li>
                          <li>The RFI/RFP document itself for context</li>
                          <li>All supporting documents you've uploaded</li>
                        </ul>
                        <p className="text-sm text-blue-700 mt-2">
                          The AI analyzes <strong>all available documents</strong> to provide comprehensive, accurate answers.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Generation Configuration */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Generation Settings</CardTitle>
              <CardDescription>Configure how your {project?.project_type || 'document'} will be generated</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Target Document Length (pages)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={targetLength}
                      onChange={(e) => setTargetLength(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <div className="w-20 text-center">
                      <input
                        type="number"
                        min="5"
                        max="50"
                        value={targetLength}
                        onChange={(e) => setTargetLength(parseInt(e.target.value) || 15)}
                        className="w-full px-2 py-1 border rounded text-center"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Approximate length of the final document. AI will adjust content detail accordingly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Generation Status */}
        <GenerationStatus 
          isGenerating={isGenerating}
          status={generationStatus}
          documents={documents.length}
          webSources={webSources.length}
        />

        <div className="mt-8 space-y-8">
          {/* Document Summaries */}
          {documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Document Summaries</CardTitle>
                <CardDescription>AI-generated summaries of your uploaded documents</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {documents.map((doc) => (
                    <DocumentSummaryCard 
                      key={doc.id} 
                      document={doc} 
                      projectId={id as string}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Web Source Summaries */}
          {webSources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Web Source Summaries</CardTitle>
                <CardDescription>AI-generated summaries of your web sources</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {webSources.map((source) => (
                    <WebSourceSummaryCard 
                      key={source.id} 
                      source={source} 
                      projectId={id as string}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {documents.length === 0 && webSources.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-gray-500">
                  Upload documents or add web sources to see AI-generated summaries
                </p>
              </CardContent>
            </Card>
          )}
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
        
        {/* Document Viewer Modal */}
        {selectedDocument && (
          <DocumentViewer
            document={selectedDocument}
            onClose={() => setSelectedDocument(null)}
          />
        )}
      </div>
    </div>
  );
}