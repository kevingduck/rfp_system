import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  HelpCircle, 
  X, 
  ChevronRight, 
  ChevronLeft,
  FileText,
  Upload,
  Globe,
  Wand2,
  Edit3,
  Download,
  Building,
  FolderOpen,
  Sparkles,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  Play,
  BookOpen
} from 'lucide-react';

interface WalkthroughStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  tips?: string[];
  videoUrl?: string;
}

interface HelpWalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
  startTab?: string;
}

export function HelpWalkthrough({ isOpen, onClose, startTab = 'overview' }: HelpWalkthroughProps) {
  const [activeTab, setActiveTab] = useState(startTab);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showQuickStart, setShowQuickStart] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BookOpen className="h-4 w-4" /> },
    { id: 'workflow', label: 'RFI/RFP Workflow', icon: <ArrowRight className="h-4 w-4" /> },
    { id: 'features', label: 'Key Features', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'tips', label: 'Pro Tips', icon: <CheckCircle className="h-4 w-4" /> },
  ];

  const workflowSteps: WalkthroughStep[] = [
    {
      id: 'create-project',
      title: 'Step 1: Create Your Project',
      description: 'Start by creating either an RFI (Request for Information) or RFP (Request for Proposal) project. RFIs are for gathering information from vendors, while RFPs are for formal proposal requests.',
      icon: <FolderOpen className="h-8 w-8 text-blue-500" />,
      tips: [
        'Choose RFI for market research and vendor discovery',
        'Choose RFP for detailed proposals from qualified vendors',
        'Give your project a descriptive name for easy reference'
      ]
    },
    {
      id: 'upload-rfi',
      title: 'Step 2: Upload Your RFI/RFP Document',
      description: 'Upload the main RFI or RFP document that contains the questions or requirements you want vendors to respond to. This document will be analyzed to extract questions automatically.',
      icon: <FileText className="h-8 w-8 text-purple-500" />,
      tips: [
        'Supported formats: PDF, Word (.docx), Excel (.xlsx), and text files',
        'The document will be highlighted in purple as your main document',
        'AI will automatically extract questions and requirements'
      ]
    },
    {
      id: 'extract-questions',
      title: 'Step 3: Extract & Review Questions',
      description: 'Click "Extract Questions from RFI/RFP" to automatically identify all questions in your document. You can then review, edit, and organize these questions.',
      icon: <Wand2 className="h-8 w-8 text-green-500" />,
      tips: [
        'Questions are extracted using AI to ensure nothing is missed',
        'Edit questions directly by clicking on them',
        'Reorder questions by dragging them',
        'Delete irrelevant questions with the trash icon'
      ]
    },
    {
      id: 'upload-supporting',
      title: 'Step 4: Add Supporting Documents',
      description: 'Upload additional documents that contain information to help answer the RFI/RFP questions. These might include company information, past proposals, technical specifications, etc.',
      icon: <Upload className="h-8 w-8 text-orange-500" />,
      tips: [
        'Upload multiple files at once for efficiency',
        'Each document is automatically summarized by AI',
        'Supporting documents help provide context for better answers'
      ]
    },
    {
      id: 'fill-answers',
      title: 'Step 5: Auto-Generate Answers',
      description: 'Click "Regenerate Answers from All Sources" to have AI analyze all your documents and generate comprehensive answers to each question.',
      icon: <Sparkles className="h-8 w-8 text-indigo-500" />,
      tips: [
        'AI uses your company info, knowledge base, and all uploaded documents',
        'Answers include citations showing where information came from',
        'You can regenerate answers anytime with updated documents'
      ]
    },
    {
      id: 'edit-refine',
      title: 'Step 6: Edit and Refine',
      description: 'Review the generated answers and make any necessary edits. You can modify answers directly in the interface to ensure accuracy and completeness.',
      icon: <Edit3 className="h-8 w-8 text-pink-500" />,
      tips: [
        'Click on any answer to edit it directly',
        'Changes are saved automatically',
        'Use the chat assistant for help with specific sections'
      ]
    },
    {
      id: 'generate-document',
      title: 'Step 7: Generate Final Document',
      description: 'Once satisfied with all answers, click "Generate RFI/RFP Response" to create a professional Word document with all your responses properly formatted.',
      icon: <FileText className="h-8 w-8 text-blue-500" />,
      tips: [
        'Document includes all sections in professional format',
        'Version history tracks all changes',
        'Export with or without source citations'
      ]
    },
    {
      id: 'export-download',
      title: 'Step 8: Export and Download',
      description: 'Download your completed RFI/RFP response as a Word document. You can choose to include citations or export a clean version for clients.',
      icon: <Download className="h-8 w-8 text-green-500" />,
      tips: [
        'Export Clean: Professional version without internal citations',
        'Export with Citations: Include source references for internal review',
        'Version history preserves all previous versions'
      ]
    }
  ];

  const features = [
    {
      title: 'Company Knowledge Base',
      description: 'Store reusable company information, certifications, and standard responses that can be automatically included in all proposals.',
      icon: <Building className="h-6 w-6 text-blue-500" />,
      location: 'Settings → Company Knowledge'
    },
    {
      title: 'AI Document Summarization',
      description: 'Every uploaded document is automatically summarized by AI, making it easier to find and use relevant information.',
      icon: <Sparkles className="h-6 w-6 text-purple-500" />,
      location: 'Automatic on document upload'
    },
    {
      title: 'Web Content Integration',
      description: 'Add web sources by URL to include online content like case studies, articles, or specifications in your responses.',
      icon: <Globe className="h-6 w-6 text-green-500" />,
      location: 'Project page → Add Web Source'
    },
    {
      title: 'Version History',
      description: 'Track all changes to your document with detailed version history showing exactly what changed between versions.',
      icon: <CheckCircle className="h-6 w-6 text-indigo-500" />,
      location: 'Draft Preview → Version History'
    },
    {
      title: 'AI Assistant',
      description: 'Get help with any task through natural language. The assistant can extract questions, manage documents, generate answers, and guide you through the process.',
      icon: <MessageSquare className="h-6 w-6 text-blue-500" />,
      location: 'Bottom right corner - blue chat button'
    }
  ];

  const proTips = [
    {
      title: 'Organize Your Knowledge Base',
      tip: 'Create categories in your company knowledge base (e.g., "Certifications", "Past Performance", "Technical Capabilities") for better organization and retrieval.'
    },
    {
      title: 'Use Descriptive File Names',
      tip: 'Name your uploaded files clearly (e.g., "ISO-9001-Certification-2024.pdf") to make them easier to identify in the sources list.'
    },
    {
      title: 'Review AI Summaries',
      tip: 'Click on document summary cards to see what key information the AI extracted - this helps verify important details were captured.'
    },
    {
      title: 'Batch Upload Documents',
      tip: 'Select multiple files at once when uploading supporting documents to save time.'
    },
    {
      title: 'Export Both Versions',
      tip: 'Export with citations for internal review, then export clean for the final client submission.'
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] overflow-y-auto">
      <div className="max-w-4xl mx-auto p-4 my-8">
        <Card className="bg-white">
          <CardHeader className="border-b">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-6 w-6 text-blue-500" />
                <CardTitle className="text-xl">RFP System Guide</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex gap-2 mt-4">
              {tabs.map(tab => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2"
                >
                  {tab.icon}
                  {tab.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    Welcome to the RFP System
                  </h3>
                  <p className="text-blue-800 mb-4">
                    This system helps you create professional RFI and RFP responses quickly using AI-powered document analysis and answer generation.
                  </p>
                  <Button
                    onClick={() => setShowQuickStart(!showQuickStart)}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Quick Start Guide
                  </Button>
                </div>

                {showQuickStart && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold">Quick Start in 5 Minutes:</h4>
                    <ol className="list-decimal list-inside space-y-2 text-sm">
                      <li>Create a new RFI or RFP project from the home page</li>
                      <li>Upload your RFI/RFP document (PDF or Word)</li>
                      <li>Click "Extract Questions" to identify all requirements</li>
                      <li>Upload supporting documents with relevant information</li>
                      <li>Click "Regenerate Answers" to auto-fill responses</li>
                      <li>Review and edit answers as needed</li>
                      <li>Generate and download your final document</li>
                    </ol>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2 text-blue-600">RFI Projects</h4>
                    <p className="text-sm text-gray-600">
                      Best for market research, vendor discovery, and gathering information about solutions.
                    </p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2 text-purple-600">RFP Projects</h4>
                    <p className="text-sm text-gray-600">
                      Best for formal proposals with detailed requirements and pricing.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Workflow Tab */}
            {activeTab === 'workflow' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    Step {currentStepIndex + 1} of {workflowSteps.length}
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
                      disabled={currentStepIndex === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStepIndex(Math.min(workflowSteps.length - 1, currentStepIndex + 1))}
                      disabled={currentStepIndex === workflowSteps.length - 1}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    {workflowSteps[currentStepIndex].icon}
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold mb-2">
                        {workflowSteps[currentStepIndex].title}
                      </h4>
                      <p className="text-gray-600 mb-4">
                        {workflowSteps[currentStepIndex].description}
                      </p>
                      
                      {workflowSteps[currentStepIndex].tips && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm font-semibold text-yellow-800 mb-1">
                            💡 Tips:
                          </p>
                          <ul className="list-disc list-inside space-y-1">
                            {workflowSteps[currentStepIndex].tips?.map((tip, i) => (
                              <li key={i} className="text-sm text-yellow-700">{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Indicator */}
                <div className="flex justify-center gap-2 mt-6">
                  {workflowSteps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 w-2 rounded-full ${
                        index === currentStepIndex
                          ? 'bg-blue-500'
                          : index < currentStepIndex
                          ? 'bg-blue-300'
                          : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Features Tab */}
            {activeTab === 'features' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Key Features</h3>
                <div className="space-y-3">
                  {features.map((feature, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        {feature.icon}
                        <div className="flex-1">
                          <h4 className="font-semibold mb-1">{feature.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{feature.description}</p>
                          <p className="text-xs text-blue-600">
                            📍 Find it at: {feature.location}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pro Tips Tab */}
            {activeTab === 'tips' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Pro Tips</h3>
                <div className="space-y-3">
                  {proTips.map((tip, index) => (
                    <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-900 mb-1">
                        {tip.title}
                      </h4>
                      <p className="text-sm text-green-800">{tip.tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          
          <div className="border-t p-4 bg-gray-50">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Need more help? Check the documentation or contact support.
              </p>
              <Button
                variant="default"
                onClick={onClose}
              >
                Got it!
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}