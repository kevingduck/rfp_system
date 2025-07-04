import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  MessageCircle, 
  Send, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Bot, 
  User, 
  Loader2,
  AlertCircle,
  CheckCircle,
  FileText,
  Edit3,
  Trash2,
  Plus,
  RefreshCw
} from 'lucide-react';

interface Message {
  id: string;
  type: 'bot' | 'user' | 'system';
  content: string;
  timestamp: Date;
  actions?: Array<{
    type: 'edit' | 'delete' | 'add' | 'generate' | 'extract';
    description: string;
    requiresConfirmation: boolean;
    data?: any;
  }>;
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}

interface SmartChatAssistantProps {
  projectId: string;
  projectType: 'RFI' | 'RFP';
  documents: any[];
  questions: any[];
  onUpdateQuestions: (questions: any[]) => void;
  onUploadDocument: (file: File) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onGenerateAnswers: () => Promise<void>;
  onExtractQuestions: () => Promise<void>;
  onGenerateDraft: () => Promise<void>;
  currentDraft?: any;
}

export function SmartChatAssistant({ 
  projectId, 
  projectType,
  documents,
  questions,
  onUpdateQuestions,
  onUploadDocument,
  onDeleteDocument,
  onGenerateAnswers,
  onExtractQuestions,
  onGenerateDraft,
  currentDraft
}: SmartChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize with welcome message
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: '1',
        type: 'bot',
        content: `Hi! I'm your ${projectType} assistant. I can help you with:
• Extracting and editing questions
• Managing documents
• Generating and improving answers
• Creating your final ${projectType} response

What would you like help with?`,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  }, [projectType]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const processUserMessage = async (message: string) => {
    const lowerMessage = message.toLowerCase();
    
    // Analyze intent
    if (lowerMessage.includes('extract') && lowerMessage.includes('question')) {
      return handleExtractQuestionsIntent();
    } else if (lowerMessage.includes('delete') && lowerMessage.includes('question')) {
      return handleDeleteQuestionIntent(message);
    } else if (lowerMessage.includes('edit') && lowerMessage.includes('question')) {
      return handleEditQuestionIntent(message);
    } else if (lowerMessage.includes('add') && lowerMessage.includes('question')) {
      return handleAddQuestionIntent(message);
    } else if (lowerMessage.includes('upload') || lowerMessage.includes('add') && lowerMessage.includes('document')) {
      return handleUploadDocumentIntent();
    } else if (lowerMessage.includes('delete') && lowerMessage.includes('document')) {
      return handleDeleteDocumentIntent(message);
    } else if (lowerMessage.includes('generate') && lowerMessage.includes('answer')) {
      return handleGenerateAnswersIntent();
    } else if (lowerMessage.includes('generate') && (lowerMessage.includes('draft') || lowerMessage.includes('document'))) {
      return handleGenerateDraftIntent();
    } else if (lowerMessage.includes('help') || lowerMessage.includes('what can')) {
      return handleHelpIntent();
    } else {
      return handleGeneralQuery(message);
    }
  };

  const handleExtractQuestionsIntent = () => {
    const action = {
      type: 'extract' as const,
      description: 'Extract questions from your uploaded RFI/RFP document',
      requiresConfirmation: true,
      execute: async () => {
        await onExtractQuestions();
      }
    };

    const botMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `I'll extract all questions from your ${projectType} document. This will:
• Analyze your main document
• Identify all questions and requirements
• Organize them for easy editing

Shall I proceed?`,
      timestamp: new Date(),
      actions: [action],
      status: 'pending'
    };
    
    setPendingAction(action);
    return botMessage;
  };

  const handleDeleteQuestionIntent = (message: string) => {
    // Try to identify which question
    const questionNumbers = message.match(/\d+/g);
    const questionKeywords = message.match(/about\s+(\w+)|regarding\s+(\w+)|question\s+(?:about\s+)?(\w+)/i);
    
    const botMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `I can help you delete questions. Which question would you like to remove?

Current questions:
${questions.slice(0, 5).map((q, i) => `${i + 1}. ${q.question_text.substring(0, 50)}...`).join('\n')}
${questions.length > 5 ? `\n... and ${questions.length - 5} more` : ''}

Please specify the question number or describe which one to delete.`,
      timestamp: new Date()
    };
    
    return botMessage;
  };

  const handleEditQuestionIntent = (message: string) => {
    const botMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `I can help you edit questions. You can:
• Click directly on any question in the main interface to edit it
• Tell me the question number and new text
• Describe which question and how to change it

Which question would you like to edit?`,
      timestamp: new Date()
    };
    
    return botMessage;
  };

  const handleAddQuestionIntent = (message: string) => {
    const botMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `I'll help you add a new question. What's the question text you'd like to add?

Example: "What is your implementation timeline?"`,
      timestamp: new Date()
    };
    
    return botMessage;
  };

  const handleUploadDocumentIntent = () => {
    const botMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `I'll help you upload a document. You can:
• Click the "Choose File" button below
• Drag and drop files onto the main document area
• Upload multiple files at once

Supported formats: PDF, Word (.docx), Excel (.xlsx), and text files`,
      timestamp: new Date()
    };
    
    // Trigger file input
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 500);
    
    return botMessage;
  };

  const handleDeleteDocumentIntent = (message: string) => {
    const botMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `I can help you remove documents. Current documents:

${documents.map((doc, i) => `${i + 1}. ${doc.filename}`).join('\n')}

Which document would you like to delete? (specify number or name)`,
      timestamp: new Date()
    };
    
    return botMessage;
  };

  const handleGenerateAnswersIntent = () => {
    const action = {
      type: 'generate' as const,
      description: 'Generate answers for all questions using your documents',
      requiresConfirmation: true,
      execute: async () => {
        await onGenerateAnswers();
      }
    };

    const botMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `I'll generate answers for all ${questions.length} questions using:
• ${documents.length} uploaded documents
• Your company knowledge base
• AI analysis of requirements

This may take a minute. Ready to proceed?`,
      timestamp: new Date(),
      actions: [action],
      status: 'pending'
    };
    
    setPendingAction(action);
    return botMessage;
  };

  const handleGenerateDraftIntent = () => {
    const action = {
      type: 'generate' as const,
      description: `Generate complete ${projectType} response document`,
      requiresConfirmation: true,
      execute: async () => {
        await onGenerateDraft();
      }
    };

    const botMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `I'll generate your complete ${projectType} response document. This will:
• Compile all questions and answers
• Format everything professionally
• Include relevant sections
• Be ready for export as Word document

${currentDraft ? '⚠️ This will replace your existing draft.' : ''}

Shall I proceed?`,
      timestamp: new Date(),
      actions: [action],
      status: 'pending'
    };
    
    setPendingAction(action);
    return botMessage;
  };

  const handleHelpIntent = () => {
    const botMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `I can help you with:

📄 **Document Management**
• "Upload a document" - Add supporting documents
• "Delete [document name]" - Remove documents
• "Show all documents" - List uploaded files

❓ **Question Management**
• "Extract questions" - Pull questions from RFI/RFP
• "Add question: [text]" - Add new question
• "Delete question [#]" - Remove specific question
• "Edit question [#]" - Modify question text

✍️ **Answer Generation**
• "Generate answers" - Auto-fill all answers
• "Improve answer for question [#]" - Enhance specific answer
• "Regenerate answers" - Update all answers

📑 **Final Document**
• "Generate draft" - Create complete response
• "Export document" - Download as Word file

What would you like to do?`,
      timestamp: new Date()
    };
    
    return botMessage;
  };

  const handleGeneralQuery = (message: string) => {
    const botMessage: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `I understand you're asking about "${message}". Let me help you with that.

Based on your project status:
• Documents uploaded: ${documents.length}
• Questions identified: ${questions.length}
• Questions with answers: ${questions.filter(q => q.answer).length}
${currentDraft ? '• Draft generated ✓' : '• No draft yet'}

What specific action would you like me to help with?`,
      timestamp: new Date()
    };
    
    return botMessage;
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isProcessing) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Process the message and get bot response
      const botResponse = await processUserMessage(message);
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'bot',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleActionConfirmation = async (confirmed: boolean) => {
    if (!pendingAction) return;

    const statusMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: confirmed ? '✓ Action confirmed. Processing...' : '✗ Action cancelled.',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, statusMessage]);

    if (confirmed && pendingAction.execute) {
      setIsProcessing(true);
      try {
        await pendingAction.execute();
        const successMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: '✓ Action completed successfully!',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);
      } catch (error) {
        const errorMessage: Message = {
          id: Date.now().toString(),
          type: 'system',
          content: '✗ Action failed. Please try again.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      } finally {
        setIsProcessing(false);
      }
    }

    setPendingAction(null);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileNames = Array.from(files).map(f => f.name).join(', ');
    const uploadMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: `Uploading: ${fileNames}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, uploadMessage]);

    try {
      for (const file of Array.from(files)) {
        await onUploadDocument(file);
      }
      const successMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: '✓ Files uploaded successfully!',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: '✗ Upload failed. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  if (!isOpen) {
    return (
      <>
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-all bg-blue-500 hover:bg-blue-600"
            size="icon"
          >
            <MessageCircle className="h-6 w-6" />
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.docx,.xlsx,.txt"
          onChange={handleFileSelect}
        />
      </>
    );
  }

  return (
    <>
      <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[600px]'} w-96`}>
        <Card className="h-full flex flex-col shadow-xl">
          <CardHeader 
            className="flex flex-row items-center justify-between p-4 border-b cursor-pointer bg-blue-500 text-white" 
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">{projectType} Assistant</CardTitle>
                <p className="text-xs text-white/80">
                  Here to help with your response
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isMinimized ? (
                <ChevronUp className="h-5 w-5 text-white" />
              ) : (
                <ChevronDown className="h-5 w-5 text-white" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="text-white/80 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                      <div className="flex items-start gap-2">
                        {message.type === 'bot' && (
                          <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <Bot className="h-5 w-5 text-white" />
                          </div>
                        )}
                        {message.type === 'system' && (
                          <div className="h-8 w-8 bg-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="h-5 w-5 text-white" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div
                            className={`rounded-lg p-3 ${
                              message.type === 'user'
                                ? 'bg-blue-500 text-white'
                                : message.type === 'system'
                                ? 'bg-gray-200 text-gray-700 text-sm'
                                : 'bg-white text-gray-800 shadow-sm'
                            }`}
                          >
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          </div>

                          {/* Action confirmation buttons */}
                          {message.actions && message.status === 'pending' && (
                            <div className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleActionConfirmation(true)}
                                disabled={isProcessing}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleActionConfirmation(false)}
                                disabled={isProcessing}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                        {message.type === 'user' && (
                          <div className="h-8 w-8 bg-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="h-5 w-5 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                        <Bot className="h-5 w-5 text-white" />
                      </div>
                      <div className="bg-white rounded-lg px-4 py-3 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </CardContent>

              <div className="p-4 border-t bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                    placeholder="Ask me anything..."
                    className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isProcessing}
                  />
                  <Button
                    onClick={() => handleSendMessage(inputValue)}
                    disabled={!inputValue.trim() || isProcessing}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.docx,.xlsx,.txt"
        onChange={handleFileSelect}
      />
    </>
  );
}