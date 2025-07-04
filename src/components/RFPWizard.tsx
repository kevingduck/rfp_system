import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ChevronRight, ChevronLeft, Upload, MessageSquare, 
  FileText, Sparkles, Check, Bot, ArrowRight,
  Building2, Target, Calendar, DollarSign, Users,
  Award, AlertCircle, Lightbulb, FileCheck, Globe
} from 'lucide-react';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  type: 'upload' | 'chat' | 'review' | 'generate';
}

interface ChatMessage {
  question: string;
  answer: string;
  category: string;
}

interface WizardProps {
  projectId: string;
  projectType: 'RFI' | 'RFP';
  documents: any[];
  webSources: any[];
  onDocumentUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onWebSourceAdd: (url: string) => void;
  onGenerate: (chatContext: any) => void;
  isGenerating: boolean;
}

export function RFPWizard({ 
  projectId, 
  projectType, 
  documents, 
  webSources,
  onDocumentUpload,
  onWebSourceAdd,
  onGenerate,
  isGenerating 
}: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [chatResponses, setChatResponses] = useState<ChatMessage[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const steps: WizardStep[] = [
    {
      id: 'upload',
      title: `Upload Client's ${projectType}`,
      description: `Upload the ${projectType} document you received from the client`,
      icon: <Upload className="h-6 w-6" />,
      type: 'upload'
    },
    {
      id: 'context',
      title: 'Supporting Documents',
      description: 'Add your company info, case studies, and certifications',
      icon: <FileCheck className="h-6 w-6" />,
      type: 'chat'
    },
    {
      id: 'review',
      title: 'Review Questions & Answers',
      description: 'Review extracted questions and edit generated answers',
      icon: <MessageSquare className="h-6 w-6" />,
      type: 'review'
    },
    {
      id: 'generate',
      title: 'Generate Response',
      description: `Create your professional vendor response to the ${projectType}`,
      icon: <Sparkles className="h-6 w-6" />,
      type: 'generate'
    }
  ];

  // Questions for each project type
  const rfiQuestions = [
    {
      category: 'alignment',
      question: "Which aspects of this RFI align best with your capabilities?",
      icon: <Target className="h-5 w-5" />,
      examples: ["Technical requirements match", "Industry experience", "Geographic coverage", "Service offerings"],
      helpText: "Helps highlight your strongest qualifications in the response"
    },
    {
      category: 'value',
      question: "What unique value can you bring to this opportunity?",
      icon: <Lightbulb className="h-5 w-5" />,
      examples: ["Cost savings approach", "Implementation expertise", "Local support team", "Innovative solutions"],
      helpText: "Emphasizes your competitive advantages early in the process"
    },
    {
      category: 'experience',
      question: "Have you worked with similar organizations or requirements?",
      icon: <Users className="h-5 w-5" />,
      examples: ["Yes, multiple similar clients", "Similar industry experience", "Comparable project scale", "New market for us"],
      helpText: "Relevant experience builds credibility in your response"
    },
    {
      category: 'approach',
      question: "What's your initial approach to meeting their needs?",
      icon: <AlertCircle className="h-5 w-5" />,
      examples: ["Phased implementation", "Full turnkey solution", "Partnership approach", "Customized offering"],
      helpText: "Shows you understand their requirements and have a plan"
    }
  ];

  const rfpQuestions = [
    {
      category: 'win_theme',
      question: "What's your main win theme for this opportunity?",
      icon: <Award className="h-5 w-5" />,
      examples: ["Best value proposition", "Technical excellence", "Proven track record", "Innovation and future-proofing"],
      helpText: "Your win theme will be woven throughout the proposal"
    },
    {
      category: 'differentiators',
      question: "What makes your solution unique for this client?",
      icon: <Lightbulb className="h-5 w-5" />,
      examples: ["Local presence", "Industry expertise", "Proprietary technology", "Customer success stories"],
      helpText: "Highlighting differentiators helps you stand out from competitors"
    },
    {
      category: 'relationship',
      question: "What's your relationship with this client?",
      icon: <Users className="h-5 w-5" />,
      examples: ["Current vendor", "Past successful projects", "New opportunity", "Partner referral"],
      helpText: "Existing relationships can strengthen your proposal"
    },
    {
      category: 'concerns',
      question: "Any concerns about requirements or competition?",
      icon: <AlertCircle className="h-5 w-5" />,
      examples: ["Tight timeline", "Technical requirements", "Strong incumbent", "Price sensitivity"],
      helpText: "Addressing concerns upfront helps craft better responses"
    }
  ];

  const questions = projectType === 'RFI' ? rfiQuestions : rfpQuestions;
  const currentQuestion = questions[chatResponses.length];

  const handleAnswerSubmit = () => {
    if (currentAnswer.trim()) {
      setChatResponses([...chatResponses, {
        question: currentQuestion.question,
        answer: currentAnswer,
        category: currentQuestion.category
      }]);
      setCurrentAnswer('');
    }
  };

  const handleSkipQuestion = () => {
    setChatResponses([...chatResponses, {
      question: currentQuestion.question,
      answer: '[Skipped]',
      category: currentQuestion.category
    }]);
  };

  const handleQuickAnswer = (answer: string) => {
    setCurrentAnswer(answer);
    setTimeout(() => handleAnswerSubmit(), 100);
  };

  const canProceedToNext = () => {
    switch (steps[currentStep].type) {
      case 'upload':
        return documents.length > 0 || webSources.length > 0;
      case 'chat':
        return chatResponses.length === questions.length;
      case 'review':
        return true;
      case 'generate':
        return false;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1 && canProceedToNext()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGenerate = () => {
    const context = {
      responses: chatResponses,
      documentCount: documents.length,
      sourceCount: webSources.length
    };
    onGenerate(context);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex-1 flex items-center">
              <div className="flex flex-col items-center flex-1">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center transition-all
                  ${index < currentStep ? 'bg-green-500 text-white' : 
                    index === currentStep ? 'bg-blue-500 text-white' : 
                    'bg-gray-200 text-gray-500'}
                `}>
                  {index < currentStep ? <Check className="h-6 w-6" /> : step.icon}
                </div>
                <p className={`mt-2 text-sm font-medium ${
                  index === currentStep ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-1 flex-1 mx-2 ${
                  index < currentStep ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {steps[currentStep].icon}
            {steps[currentStep].title}
          </CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Upload Step */}
          {steps[currentStep].type === 'upload' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Step 1:</strong> Upload the {projectType} document you received from the client. 
                  This document contains the questions and requirements we need to respond to. 
                  We'll analyze it to extract all questions automatically.
                </p>
              </div>
              
              {documents.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Important:</strong> The first document should be the client's {projectType}. 
                    Additional supporting documents can be added in the next step.
                  </p>
                </div>
              )}
              
              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Drop files here or click to upload</p>
                <p className="text-sm text-gray-500 mb-4">
                  Supports PDF, Word, Excel, and text files
                </p>
                <input
                  type="file"
                  onChange={onDocumentUpload}
                  accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.xlsm"
                  className="hidden"
                  id="wizard-file-upload"
                  multiple
                />
                <label htmlFor="wizard-file-upload">
                  <Button variant="outline" asChild>
                    <span>Choose Files</span>
                  </Button>
                </label>
              </div>

              {/* Web Source Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Add Web Source (Optional)</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/rfp-details"
                    className="flex-1 px-3 py-2 border rounded-md"
                  />
                  <Button
                    onClick={() => {
                      if (urlInput.trim()) {
                        onWebSourceAdd(urlInput);
                        setUrlInput('');
                      }
                    }}
                    disabled={!urlInput.trim()}
                  >
                    Add URL
                  </Button>
                </div>
              </div>

              {/* Uploaded Files List */}
              {(documents.length > 0 || webSources.length > 0) && (
                <div className="space-y-4">
                  <h4 className="font-medium">Uploaded Resources</h4>
                  
                  {documents.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">Documents ({documents.length})</p>
                      <div className="space-y-1">
                        {documents.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2 text-sm">
                            <FileCheck className="h-4 w-4 text-green-600" />
                            <span>{doc.filename}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {webSources.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-500">Web Sources ({webSources.length})</p>
                      <div className="space-y-1">
                        {webSources.map((source) => (
                          <div key={source.id} className="flex items-center gap-2 text-sm">
                            <Globe className="h-4 w-4 text-blue-600" />
                            <span className="truncate">{source.title || source.url}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {documents.length === 0 && webSources.length === 0 && (
                <p className="text-center text-gray-500">Please upload at least one document or add a web source to continue</p>
              )}
            </div>
          )}

          {/* Chat Step */}
          {steps[currentStep].type === 'chat' && currentQuestion && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                    {currentQuestion.icon}
                    {currentQuestion.question}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">{currentQuestion.helpText}</p>
                  
                  <textarea
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full p-3 border rounded-lg h-24 resize-none"
                  />
                  
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-2">Quick answers:</p>
                    <div className="flex flex-wrap gap-2">
                      {currentQuestion.examples.map((example, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuickAnswer(example)}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm transition-colors"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    <Button onClick={handleAnswerSubmit} disabled={!currentAnswer.trim()}>
                      Submit Answer
                    </Button>
                    <Button variant="outline" onClick={handleSkipQuestion}>
                      Skip Question
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500">
                  Question {chatResponses.length + 1} of {questions.length}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${((chatResponses.length + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* All questions answered */}
          {steps[currentStep].type === 'chat' && !currentQuestion && (
            <div className="text-center py-8">
              <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">All questions answered!</h3>
              <p className="text-gray-600">Click "Next" to review your inputs before generating the {projectType}.</p>
            </div>
          )}

          {/* Review Step */}
          {steps[currentStep].type === 'review' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium mb-3">Document Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Uploaded Documents</p>
                    <p className="font-medium">{documents.length} files</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Web Sources</p>
                    <p className="font-medium">{webSources.length} sources</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-medium">Your Responses</h3>
                {chatResponses.map((response, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-700">{response.question}</p>
                    <p className="mt-1">{response.answer}</p>
                  </div>
                ))}
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>Ready to generate!</strong> The AI will use your uploaded documents and responses 
                  to create a comprehensive {projectType} tailored to your needs.
                </p>
              </div>
            </div>
          )}

          {/* Generate Step */}
          {steps[currentStep].type === 'generate' && (
            <div className="text-center py-12">
              <Sparkles className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">Ready to Generate Your {projectType} Draft</h3>
              <p className="text-gray-600 mb-4">
                Click below to generate a draft with citations that you can review and edit before finalizing.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <p className="text-sm text-blue-800">
                  <strong>What happens next:</strong><br/>
                  • Real-time progress updates as we process your documents<br/>
                  • Draft opens in browser with source citations<br/>
                  • Edit any section before downloading<br/>
                  • Export final version without citations
                </p>
              </div>
              <Button 
                onClick={handleGenerate} 
                disabled={isGenerating}
                size="lg"
                className="mx-auto"
              >
                {isGenerating ? 'Generating Draft...' : `Generate ${projectType} Draft`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        
        {currentStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            disabled={!canProceedToNext()}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}