import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Send, X, ChevronDown, ChevronUp, Bot, User, HelpCircle, SkipForward } from 'lucide-react';

interface Message {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
  quickReplies?: string[];
  explanation?: string;
}

interface ChatAssistantProps {
  projectId: string;
  projectType: 'RFI' | 'RFP';
  onChatComplete?: (context: any) => void;
  isGenerating?: boolean;
}

export function ChatAssistant({ projectId, projectType, onChatComplete, isGenerating }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [chatContext, setChatContext] = useState<Record<string, any>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showExplanation, setShowExplanation] = useState<string | null>(null);

  useEffect(() => {
    // Initialize chat with welcome message
    if (messages.length === 0 && !isGenerating) {
      const welcomeMessage: Message = {
        id: '1',
        type: 'bot',
        content: `Hi! I'm your ${projectType} assistant. I've reviewed your uploaded documents and I'd like to ask you a few questions to help create the perfect ${projectType === 'RFI' ? 'request for information' : 'proposal response'}. This will only take a few minutes and will greatly improve the quality of your document.`,
        timestamp: new Date(),
        quickReplies: ['Let\'s start!', 'Tell me more', 'Skip questions']
      };
      setMessages([welcomeMessage]);
      setIsOpen(true);
    }
  }, [projectType, messages.length, isGenerating]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Save context
    setChatContext(prev => ({
      ...prev,
      [`question_${currentQuestionIndex}`]: message
    }));

    // Simulate API call for next question
    setTimeout(() => {
      askNextQuestion();
    }, 1000);
  };

  const askNextQuestion = () => {
    setIsTyping(false);

    // Sample questions based on project type
    const rfiQuestions = [
      {
        question: "What specific information are you hoping to gather from vendors with this RFI?",
        explanation: "This helps me focus the RFI on your key information needs",
        quickReplies: ["Technical capabilities", "Pricing models", "Implementation timelines", "All of the above"]
      },
      {
        question: "What's your timeline for this project?",
        explanation: "Knowing your timeline helps set appropriate deadlines and expectations",
        quickReplies: ["ASAP", "Next quarter", "6-12 months", "Just exploring"]
      },
      {
        question: "Are there any specific pain points with your current solution?",
        explanation: "Understanding current challenges helps frame the RFI context",
        quickReplies: ["Reliability issues", "Cost concerns", "Feature limitations", "No current solution"]
      },
      {
        question: "What's your approximate budget range for this initiative?",
        explanation: "This helps vendors provide relevant solutions within your range",
        quickReplies: ["Under $50k", "$50k-$150k", "$150k-$500k", "Prefer not to say"]
      }
    ];

    const rfpQuestions = [
      {
        question: "What's your main win theme for this opportunity?",
        explanation: "A win theme helps focus our entire proposal on what matters most to the client",
        quickReplies: ["Cost savings", "Technical superiority", "Proven experience", "Innovation"]
      },
      {
        question: "Do you have any existing relationship with this client?",
        explanation: "Existing relationships can be a strong differentiator in proposals",
        quickReplies: ["Current vendor", "Past projects", "New opportunity", "Partner referral"]
      },
      {
        question: "What do you think is your biggest competitive advantage for this RFP?",
        explanation: "Highlighting your strengths helps me emphasize them throughout the proposal",
        quickReplies: ["Local presence", "Technical expertise", "Competitive pricing", "Customer service"]
      },
      {
        question: "Are there any specific requirements in the RFP you're concerned about?",
        explanation: "Addressing concerns upfront helps craft better responses",
        quickReplies: ["Technical requirements", "Timeline", "Certifications", "None - we're ready!"]
      }
    ];

    const questions = projectType === 'RFI' ? rfiQuestions : rfpQuestions;

    if (currentQuestionIndex < questions.length) {
      const nextQuestion = questions[currentQuestionIndex];
      const botMessage: Message = {
        id: Date.now().toString(),
        type: 'bot',
        content: nextQuestion.question,
        timestamp: new Date(),
        quickReplies: nextQuestion.quickReplies,
        explanation: nextQuestion.explanation
      };
      setMessages(prev => [...prev, botMessage]);
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // All questions answered
      const completionMessage: Message = {
        id: Date.now().toString(),
        type: 'bot',
        content: `Perfect! I now have all the information I need to help generate an excellent ${projectType}. Your insights will help me create a more targeted and effective document. Click "Generate Document" when you're ready!`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, completionMessage]);
      
      // Pass context to parent
      if (onChatComplete) {
        onChatComplete(chatContext);
      }
    }
  };

  const handleQuickReply = (reply: string) => {
    if (reply === 'Skip questions') {
      const skipMessage: Message = {
        id: Date.now().toString(),
        type: 'bot',
        content: "No problem! I'll work with the information from your uploaded documents. You can always chat with me later if you'd like to provide more context.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, skipMessage]);
      setCurrentQuestionIndex(999); // Skip all questions
      if (onChatComplete) {
        onChatComplete(chatContext);
      }
    } else {
      handleSendMessage(reply);
    }
  };

  const handleSkipQuestion = () => {
    const skipMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: '[Skipped question]',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, skipMessage]);
    
    setTimeout(() => {
      askNextQuestion();
    }, 500);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-shadow"
          size="icon"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[600px]'} w-96`}>
      <Card className="h-full flex flex-col shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">RFP Assistant</CardTitle>
              <p className="text-xs text-gray-500">
                {currentQuestionIndex > 0 ? `Question ${Math.min(currentQuestionIndex, 4)} of 4` : 'Ready to help'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMinimized ? (
              <ChevronUp className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>

        {!isMinimized && (
          <>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                    <div className="flex items-start gap-2">
                      {message.type === 'bot' && (
                        <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div>
                        <div
                          className={`rounded-lg p-3 ${
                            message.type === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {message.content}
                        </div>
                        
                        {/* Explanation tooltip */}
                        {message.explanation && (
                          <div className="mt-1 flex items-center">
                            <button
                              onClick={() => setShowExplanation(showExplanation === message.id ? null : message.id)}
                              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                            >
                              <HelpCircle className="h-3 w-3" />
                              Why am I asking?
                            </button>
                          </div>
                        )}
                        
                        {showExplanation === message.id && message.explanation && (
                          <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-800">
                            {message.explanation}
                          </div>
                        )}

                        {/* Quick replies */}
                        {message.quickReplies && message.type === 'bot' && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.quickReplies.map((reply, index) => (
                              <button
                                key={index}
                                onClick={() => handleQuickReply(reply)}
                                className="text-xs px-3 py-1 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                              >
                                {reply}
                              </button>
                            ))}
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

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="bg-gray-100 rounded-lg px-4 py-3">
                      <div className="flex gap-1">
                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </CardContent>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                  placeholder="Type your answer..."
                  className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button
                  onClick={() => handleSendMessage(inputValue)}
                  disabled={!inputValue.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
                {currentQuestionIndex > 0 && currentQuestionIndex <= 4 && (
                  <Button
                    onClick={handleSkipQuestion}
                    variant="outline"
                    size="icon"
                    title="Skip this question"
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}