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
  RefreshCw,
  Info,
  XCircle,
  FileX,
  HelpCircle
} from 'lucide-react';

type ConversationState = 
  | 'idle' 
  | 'awaiting_question_selection_for_delete'
  | 'awaiting_question_selection_for_edit'
  | 'awaiting_question_text_for_add'
  | 'awaiting_question_edit_text'
  | 'awaiting_document_selection'
  | 'confirming_action';

interface Message {
  id: string;
  type: 'bot' | 'user' | 'system' | 'error';
  content: string;
  timestamp: Date;
  actions?: Array<{
    type: 'edit' | 'delete' | 'add' | 'generate' | 'extract';
    description: string;
    requiresConfirmation: boolean;
    data?: any;
  }>;
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  quickActions?: Array<{
    label: string;
    value: string;
  }>;
}

interface ConversationContext {
  state: ConversationState;
  data?: any;
}

interface EnhancedChatAssistantProps {
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
  onRefreshQuestions?: () => Promise<void>;
  onSetMainDocument?: (documentId: string) => Promise<void>;
  mainDocument?: any;
  currentDraft?: any;
}

export function EnhancedChatAssistant({ 
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
  onRefreshQuestions,
  onSetMainDocument,
  mainDocument,
  currentDraft
}: EnhancedChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [conversationContext, setConversationContext] = useState<ConversationContext>({
    state: 'idle'
  });
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

Type "help" for commands or "status" to see project overview.`,
        timestamp: new Date(),
        quickActions: [
          { label: 'Show Status', value: 'status' },
          { label: 'Extract Questions', value: 'extract questions' },
          { label: 'Help', value: 'help' }
        ]
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

  const resetConversation = () => {
    setConversationContext({ state: 'idle' });
    setPendingAction(null);
  };

  const processUserMessage = async (message: string): Promise<Message> => {
    const lowerMessage = message.toLowerCase().trim();
    
    // Handle cancel command
    if (lowerMessage === 'cancel' && conversationContext.state !== 'idle') {
      resetConversation();
      return createBotMessage('Operation cancelled. How can I help you?');
    }

    // Handle conversation state
    switch (conversationContext.state) {
      case 'awaiting_question_selection_for_delete':
        return handleQuestionDeleteSelection(message);
      case 'awaiting_question_selection_for_edit':
        return handleQuestionEditSelection(message);
      case 'awaiting_question_text_for_add':
        return handleQuestionAdd(message);
      case 'awaiting_question_edit_text':
        return handleQuestionEditText(message);
      case 'awaiting_document_selection':
        return handleDocumentSelection(message);
      default:
        // Process new commands
        return processNewCommand(lowerMessage);
    }
  };

  const processNewCommand = async (message: string) => {
    // Check for basic commands first
    if (message === 'help' || message === 'status') {
      // Handle basic commands locally for speed
      if (message === 'help') {
        return handleHelpIntent();
      }
      if (message === 'status') {
        return handleStatusCommand();
      }
    }

    // For all other messages, use AI to understand intent
    try {
      const response = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context: {
            hasDocuments: documents.length > 0,
            hasDraft: !!currentDraft,
            draftSections: currentDraft ? Object.keys(currentDraft.sections || {}) : [],
            questionCount: questions.length,
            answeredQuestions: questions.filter(q => q.answer).length,
            mainDocument: mainDocument
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process message');
      }

      const data = await response.json();

      // Handle actions from AI
      if (data.action) {
        switch (data.action.type) {
          case 'update_draft':
            // Draft has been updated, trigger refresh
            if (onRefreshQuestions) {
              await onRefreshQuestions();
            }
            // Reload the page to show updated draft
            window.location.reload();
            break;

          case 'generate_draft':
            await onGenerateDraft();
            break;

          case 'extract_questions':
            await onExtractQuestions();
            break;
        }
      }

      // Return the AI's message with suggestions as quick actions
      return createBotMessage(
        data.response,
        data.suggestions?.map((s: string) => ({ label: s, value: s }))
      );

    } catch (error) {
      console.error('AI chat error:', error);

      // Fallback to pattern matching for basic operations
      if (message.includes('list document')) {
        return handleListDocuments();
      }
      if (message.includes('extract') && message.includes('question')) {
        return handleExtractQuestionsIntent();
      }
      if (message.includes('generate') && message.includes('draft')) {
        return handleGenerateDraftIntent();
      }

      return createErrorMessage('I had trouble understanding that. Try asking differently or use "help" for available commands.');
    }
  };

  const createBotMessage = (content: string, quickActions?: any[]): Message => ({
    id: Date.now().toString(),
    type: 'bot',
    content,
    timestamp: new Date(),
    quickActions
  });

  const createErrorMessage = (content: string): Message => ({
    id: Date.now().toString(),
    type: 'error',
    content,
    timestamp: new Date()
  });

  const createSystemMessage = (content: string): Message => ({
    id: Date.now().toString(),
    type: 'system',
    content,
    timestamp: new Date()
  });

  // Command Handlers
  const handleStatusCommand = () => {
    const answeredQuestions = questions.filter(q => q.answer).length;
    const unansweredQuestions = questions.length - answeredQuestions;
    
    const content = `📊 **Project Status Overview**

**Project:** ${projectType} - ${questions.length > 0 ? 'In Progress' : 'Getting Started'}

**Main ${projectType} Document:** ${mainDocument ? `✓ ${mainDocument.filename}` : '❌ Not set'}

**Documents:** ${documents.length} uploaded
${documents.slice(0, 3).map((doc, i) => `  ${i + 1}. ${doc.filename}${doc.is_main_document ? ' (main)' : ''}`).join('\n')}
${documents.length > 3 ? `  ... and ${documents.length - 3} more` : ''}

**Questions:** ${questions.length} total
  ✓ Answered: ${answeredQuestions}
  ⏳ Pending: ${unansweredQuestions}

**Draft Status:** ${currentDraft ? '✓ Generated' : '❌ Not generated yet'}

**Next Steps:**
${!mainDocument ? '• Set a main document to extract questions from' : ''}
${mainDocument && questions.length === 0 ? '• Extract questions from your main document' : ''}
${unansweredQuestions > 0 ? '• Generate answers for remaining questions' : ''}
${questions.length > 0 && !currentDraft ? '• Generate the final draft document' : ''}
${currentDraft ? '• Review and export your draft' : ''}`;

    const quickActions = [];
    if (!mainDocument && documents.length > 0) {
      quickActions.push({ label: 'Set Main Document', value: 'set main document' });
    }
    if (mainDocument && questions.length === 0) {
      quickActions.push({ label: 'Extract Questions', value: 'extract questions' });
    }
    if (questions.length > 0 && unansweredQuestions > 0) {
      quickActions.push({ label: 'Generate Answers', value: 'generate answers' });
    }
    if (questions.length > 0) {
      quickActions.push({ label: 'Generate Draft', value: 'generate draft' });
    }

    return createBotMessage(content, quickActions);
  };

  const handleListDocuments = () => {
    if (documents.length === 0) {
      return createBotMessage('No documents uploaded yet. Would you like to upload one?', [
        { label: 'Upload Document', value: 'upload document' }
      ]);
    }

    const content = `📁 **Uploaded Documents** (${documents.length} total)

${documents.map((doc, i) => 
  `${i + 1}. **${doc.filename}**
   Type: ${doc.file_type || 'Unknown'}
   Uploaded: ${new Date(doc.uploadedAt || doc.uploaded_at).toLocaleDateString()}
   ${doc.metadata?.summary_cache ? '✓ Summarized' : '⏳ Processing'}`
).join('\n\n')}

You can delete a document by saying "delete document [number]" or upload more documents.`;

    return createBotMessage(content, [
      { label: 'Upload More', value: 'upload document' },
      { label: 'Delete Document', value: 'delete document' }
    ]);
  };

  const handleShowQuestion = (message: string) => {
    const match = message.match(/(\d+)/);
    if (!match) return createErrorMessage('Please specify a question number.');
    
    const questionNum = parseInt(match[1]) - 1;
    if (questionNum < 0 || questionNum >= questions.length) {
      return createErrorMessage(`Question ${match[1]} not found. We have ${questions.length} questions.`);
    }
    
    const question = questions[questionNum];
    const content = `**Question ${questionNum + 1}:**
${question.question_text}

**Answer:**
${question.answer || '*No answer provided yet*'}

**Category:** ${question.category || 'General'}
**Required:** ${question.required ? 'Yes' : 'No'}`;

    return createBotMessage(content, [
      { label: 'Edit This Question', value: `edit question ${questionNum + 1}` },
      { label: 'Delete This Question', value: `delete question ${questionNum + 1}` }
    ]);
  };

  // Question Management
  const handleDeleteQuestionIntent = () => {
    if (questions.length === 0) {
      return createBotMessage('No questions to delete. Extract questions from your RFI/RFP first.', [
        { label: 'Extract Questions', value: 'extract questions' }
      ]);
    }

    setConversationContext({ 
      state: 'awaiting_question_selection_for_delete' 
    });

    const content = `Which question would you like to delete? Reply with the number or "cancel" to abort.

${questions.slice(0, 10).map((q, i) => 
  `${i + 1}. ${q.question_text.substring(0, 60)}${q.question_text.length > 60 ? '...' : ''}`
).join('\n')}
${questions.length > 10 ? `\n... and ${questions.length - 10} more (show questions 11-${questions.length})` : ''}`;

    return createBotMessage(content);
  };

  const handleQuestionDeleteSelection = async (message: string) => {
    const match = message.match(/(\d+)/);
    if (!match) {
      return createErrorMessage('Please provide a valid question number or say "cancel".');
    }
    
    const questionNum = parseInt(match[1]) - 1;
    if (questionNum < 0 || questionNum >= questions.length) {
      return createErrorMessage(`Question ${match[1]} not found. Please choose between 1 and ${questions.length}.`);
    }
    
    const questionToDelete = questions[questionNum];
    
    // Actually delete the question
    try {
      setIsProcessing(true);
      const response = await fetch(`/api/projects/${projectId}/questions/${questionToDelete.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete question');
      }
      
      // Refresh questions from server
      if (onRefreshQuestions) {
        await onRefreshQuestions();
      } else {
        // Fallback to local update
        const updatedQuestions = questions.filter(q => q.id !== questionToDelete.id);
        onUpdateQuestions(updatedQuestions);
      }
      
      resetConversation();
      return createSystemMessage(`✓ Question ${questionNum + 1} deleted successfully!`);
    } catch (error) {
      return createErrorMessage('Failed to delete question. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditQuestionIntent = () => {
    if (questions.length === 0) {
      return createBotMessage('No questions to edit. Extract questions from your RFI/RFP first.', [
        { label: 'Extract Questions', value: 'extract questions' }
      ]);
    }

    setConversationContext({ 
      state: 'awaiting_question_selection_for_edit' 
    });

    const content = `Which question would you like to edit? Reply with the number.

${questions.slice(0, 10).map((q, i) => 
  `${i + 1}. ${q.question_text.substring(0, 60)}${q.question_text.length > 60 ? '...' : ''}`
).join('\n')}`;

    return createBotMessage(content);
  };

  const handleQuestionEditSelection = async (message: string) => {
    const match = message.match(/(\d+)/);
    if (!match) {
      return createErrorMessage('Please provide a valid question number.');
    }
    
    const questionNum = parseInt(match[1]) - 1;
    if (questionNum < 0 || questionNum >= questions.length) {
      return createErrorMessage(`Question ${match[1]} not found.`);
    }
    
    const questionToEdit = questions[questionNum];
    setConversationContext({ 
      state: 'awaiting_question_edit_text',
      data: { questionId: questionToEdit.id, questionNum }
    });

    return createBotMessage(`Current text:
"${questionToEdit.question_text}"

Please provide the new text for this question:`);
  };

  const handleQuestionEditText = async (newText: string) => {
    const { questionId, questionNum } = conversationContext.data;
    
    try {
      setIsProcessing(true);
      const response = await fetch(`/api/projects/${projectId}/questions/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_text: newText })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update question');
      }
      
      // Refresh questions from server
      if (onRefreshQuestions) {
        await onRefreshQuestions();
      } else {
        // Fallback to local update
        const updatedQuestions = [...questions];
        const questionIndex = questions.findIndex(q => q.id === questionId);
        if (questionIndex !== -1) {
          updatedQuestions[questionIndex] = {
            ...updatedQuestions[questionIndex],
            question_text: newText
          };
          onUpdateQuestions(updatedQuestions);
        }
      }
      
      resetConversation();
      return createSystemMessage(`✓ Question ${questionNum + 1} updated successfully!`);
    } catch (error) {
      return createErrorMessage('Failed to update question. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddQuestionIntent = () => {
    setConversationContext({ 
      state: 'awaiting_question_text_for_add' 
    });
    
    return createBotMessage(`What question would you like to add?

Example: "What is your proposed implementation timeline?"`);
  };

  const handleQuestionAdd = async (questionText: string) => {
    if (!questionText.trim()) {
      return createErrorMessage('Please provide the question text.');
    }
    
    try {
      setIsProcessing(true);
      const response = await fetch(`/api/projects/${projectId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question_text: questionText,
          question_type: 'text',
          required: true,
          category: 'General'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add question');
      }
      
      // Refresh questions from server
      if (onRefreshQuestions) {
        await onRefreshQuestions();
      } else {
        // Fallback to local update
        const newQuestion = await response.json();
        const updatedQuestions = [...questions, newQuestion];
        onUpdateQuestions(updatedQuestions);
      }
      
      resetConversation();
      return createSystemMessage(`✓ Question added successfully! You now have ${questions.length + 1} questions.`);
    } catch (error) {
      return createErrorMessage('Failed to add question. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Document Management
  const handleDeleteDocumentIntent = () => {
    if (documents.length === 0) {
      return createBotMessage('No documents to delete. Upload some documents first.', [
        { label: 'Upload Document', value: 'upload document' }
      ]);
    }

    setConversationContext({ 
      state: 'awaiting_document_selection' 
    });

    const content = `Which document would you like to delete? Reply with the number or filename.

${documents.map((doc, i) => `${i + 1}. ${doc.filename}`).join('\n')}`;

    return createBotMessage(content);
  };

  const handleDocumentSelection = async (message: string) => {
    const { action } = conversationContext.data || {};
    let documentToSelect = null;
    
    // Try to match by number first
    const numberMatch = message.match(/(\d+)/);
    if (numberMatch) {
      const docNum = parseInt(numberMatch[1]) - 1;
      if (docNum >= 0 && docNum < documents.length) {
        documentToSelect = documents[docNum];
      }
    }
    
    // Try to match by filename
    if (!documentToSelect) {
      documentToSelect = documents.find(doc => 
        doc.filename.toLowerCase().includes(message.toLowerCase())
      );
    }
    
    if (!documentToSelect) {
      return createErrorMessage('Document not found. Please provide a valid number or filename.');
    }
    
    try {
      setIsProcessing(true);
      
      if (action === 'set_main') {
        // Set as main document
        if (onSetMainDocument) {
          await onSetMainDocument(documentToSelect.id);
          resetConversation();
          return createSystemMessage(`✓ "${documentToSelect.filename}" is now the main ${projectType} document. Please extract questions from it.`);
        } else {
          return createErrorMessage('Main document management is not available.');
        }
      } else {
        // Delete document
        await onDeleteDocument(documentToSelect.id);
        resetConversation();
        return createSystemMessage(`✓ Document "${documentToSelect.filename}" deleted successfully!`);
      }
    } catch (error) {
      return createErrorMessage(action === 'set_main' ? 'Failed to set main document.' : 'Failed to delete document.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Other existing handlers (extract questions, generate answers, etc.)
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

  const handleUploadDocumentIntent = () => {
    const botMessage = createBotMessage(`I'll help you upload a document. Click the button below to select files.

Supported formats: PDF, Word (.docx), Excel (.xlsx), and text files`);
    
    // Trigger file input
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 500);
    
    return botMessage;
  };

  const handleGenerateAnswersIntent = () => {
    if (questions.length === 0) {
      return createBotMessage('No questions found. Extract questions first.', [
        { label: 'Extract Questions', value: 'extract questions' }
      ]);
    }

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
    if (questions.length === 0) {
      return createBotMessage('Generate a draft requires questions. Extract them first.', [
        { label: 'Extract Questions', value: 'extract questions' }
      ]);
    }

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
    const content = `📚 **Available Commands**

**📊 Status & Info**
• \`status\` - Show project overview
• \`list documents\` - Show all uploaded documents
• \`show question [#]\` - Display specific question
• \`main document\` - Show current main ${projectType} document

**❓ Question Management**
• \`extract questions\` - Pull questions from main document
• \`add question\` - Add a new question
• \`edit question [#]\` - Modify question text
• \`delete question [#]\` - Remove a question

**📄 Document Management**
• \`upload document\` - Add supporting documents
• \`delete document [#/name]\` - Remove a document
• \`set main document\` - Choose which document to extract questions from

**✍️ Generation**
• \`generate answers\` - Auto-fill all answers
• \`generate draft\` - Create complete response

**Other**
• \`cancel\` - Cancel current operation
• \`help\` - Show this help message`;

    return createBotMessage(content, [
      { label: 'Show Status', value: 'status' },
      { label: 'List Documents', value: 'list documents' }
    ]);
  };

  const handleShowMainDocument = () => {
    if (!mainDocument) {
      return createBotMessage(`No main ${projectType} document is currently set. Would you like to set one?`, [
        { label: 'Set Main Document', value: 'set main document' }
      ]);
    }

    const content = `📑 **Main ${projectType} Document**

**Filename:** ${mainDocument.filename}
**Type:** ${mainDocument.file_type || 'Document'}
**Uploaded:** ${new Date(mainDocument.uploadedAt || mainDocument.uploaded_at).toLocaleDateString()}
${mainDocument.metadata?.summary_cache ? '✓ Summarized' : '⏳ Processing'}

This is the primary document we're responding to. All questions should be extracted from this document.`;

    return createBotMessage(content, [
      { label: 'Extract Questions', value: 'extract questions' },
      { label: 'Change Main Document', value: 'set main document' }
    ]);
  };

  const handleSetMainDocumentIntent = () => {
    if (!onSetMainDocument) {
      return createErrorMessage('Main document management is not available.');
    }

    if (documents.length === 0) {
      return createBotMessage('No documents available. Upload some documents first.', [
        { label: 'Upload Document', value: 'upload document' }
      ]);
    }

    setConversationContext({ 
      state: 'awaiting_document_selection',
      data: { action: 'set_main' }
    });

    const content = `Which document should be the main ${projectType} document? Reply with the number or filename.

${documents.map((doc, i) => 
  `${i + 1}. ${doc.filename}${doc.is_main_document ? ' (current main)' : ''}`
).join('\n')}

**Note:** Setting a new main document will require re-extracting questions.`;

    return createBotMessage(content);
  };

  const handleGeneralQuery = (message: string) => {
    const suggestions = [];
    
    // Suggest relevant actions based on project state
    if (documents.length === 0) {
      suggestions.push({ label: 'Upload Document', value: 'upload document' });
    }
    if (questions.length === 0 && documents.length > 0) {
      suggestions.push({ label: 'Extract Questions', value: 'extract questions' });
    }
    if (questions.some(q => !q.answer)) {
      suggestions.push({ label: 'Generate Answers', value: 'generate answers' });
    }
    if (!currentDraft && questions.length > 0) {
      suggestions.push({ label: 'Generate Draft', value: 'generate draft' });
    }
    
    return createBotMessage(
      `I'm not sure what "${message}" means. Try "help" to see available commands or use one of these suggestions:`,
      suggestions.length > 0 ? suggestions : [{ label: 'Help', value: 'help' }]
    );
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

    // Add thinking indicator if the message might use AI
    const needsAI = !['help', 'status'].includes(message.toLowerCase());
    if (needsAI) {
      const thinkingMessage: Message = {
        id: `thinking-${Date.now()}`,
        type: 'bot',
        content: '🤔 Thinking...',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, thinkingMessage]);
    }

    try {
      // Process the message and get bot response
      const botResponse = await processUserMessage(message);
      if (botResponse) {
        // Remove thinking message and add actual response
        setMessages(prev => {
          const filtered = prev.filter(m => !m.id.startsWith('thinking-'));
          return [...filtered, botResponse];
        });
      }
    } catch (error) {
      const errorMessage = createErrorMessage('Sorry, something went wrong. Please try again.');
      setMessages(prev => {
        const filtered = prev.filter(m => !m.id.startsWith('thinking-'));
        return [...filtered, errorMessage];
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAction = (value: string) => {
    handleSendMessage(value);
  };

  const handleActionConfirmation = async (confirmed: boolean) => {
    if (!pendingAction) return;

    const statusMessage = createSystemMessage(
      confirmed ? '✓ Action confirmed. Processing...' : '✗ Action cancelled.'
    );
    setMessages(prev => [...prev, statusMessage]);

    if (confirmed && pendingAction.execute) {
      setIsProcessing(true);
      try {
        await pendingAction.execute();
        const successMessage = createSystemMessage('✓ Action completed successfully!');
        setMessages(prev => [...prev, successMessage]);
      } catch (error) {
        const errorMessage = createErrorMessage('✗ Action failed. Please try again.');
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
    const uploadMessage = createSystemMessage(`Uploading: ${fileNames}`);
    setMessages(prev => [...prev, uploadMessage]);

    try {
      for (const file of Array.from(files)) {
        await onUploadDocument(file);
      }
      const successMessage = createSystemMessage('✓ Files uploaded successfully!');
      setMessages(prev => [...prev, successMessage]);
    } catch (error) {
      const errorMessage = createErrorMessage('✗ Upload failed. Please try again.');
      setMessages(prev => [...prev, errorMessage]);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) {
    return (
      <>
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-all bg-blue-500 hover:bg-blue-600 relative"
            size="icon"
          >
            <MessageCircle className="h-6 w-6" />
            {questions.length > 0 && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse" />
            )}
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
                  {conversationContext.state !== 'idle' ? 'Processing...' : 'Ready to help'}
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
                          <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <CheckCircle className="h-5 w-5 text-white" />
                          </div>
                        )}
                        {message.type === 'error' && (
                          <div className="h-8 w-8 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                            <XCircle className="h-5 w-5 text-white" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div
                            className={`rounded-lg p-3 ${
                              message.type === 'user'
                                ? 'bg-blue-500 text-white'
                                : message.type === 'system'
                                ? 'bg-green-50 text-green-800 text-sm border border-green-200'
                                : message.type === 'error'
                                ? 'bg-red-50 text-red-800 text-sm border border-red-200'
                                : 'bg-white text-gray-800 shadow-sm'
                            }`}
                          >
                            {message.id.startsWith('thinking-') ? (
                              <div className="flex items-center gap-2">
                                <span>{message.content}</span>
                                <div className="flex gap-1">
                                  <span className="animate-bounce inline-block" style={{ animationDelay: '0ms' }}>.</span>
                                  <span className="animate-bounce inline-block" style={{ animationDelay: '150ms' }}>.</span>
                                  <span className="animate-bounce inline-block" style={{ animationDelay: '300ms' }}>.</span>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{
                                  __html: message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                }}
                              />
                            )}
                          </div>

                          {/* Quick action buttons */}
                          {message.quickActions && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {message.quickActions.map((action, idx) => (
                                <Button
                                  key={idx}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleQuickAction(action.value)}
                                  className="text-xs"
                                >
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          )}

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
                {conversationContext.state !== 'idle' && (
                  <div className="mb-2 text-xs text-gray-500 flex items-center justify-between">
                    <span>Type your response or say "cancel"</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        resetConversation();
                        setMessages(prev => [...prev, createSystemMessage('Operation cancelled.')]);
                      }}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                    placeholder={conversationContext.state !== 'idle' ? 'Type your response...' : 'Ask me anything...'}
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
                <div className="mt-2 text-xs text-gray-400">
                  Type "help" for commands or "status" for overview
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