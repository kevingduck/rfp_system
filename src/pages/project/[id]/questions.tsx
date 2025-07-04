import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  required: boolean;
  order_index: number;
  category?: string;
  answer?: string;
}

interface Project {
  id: string;
  name: string;
  project_type: 'RFI' | 'RFP';
}

export default function QuestionsPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [project, setProject] = useState<Project | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [isRequired, setIsRequired] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingAnswers, setEditingAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchQuestions();
    }
  }, [id]);

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.project_type !== 'RFI') {
          router.push(`/project/${id}`);
        } else {
          setProject(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/questions`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data);
      }
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    }
  };

  const addQuestion = async () => {
    if (!newQuestion.trim()) return;

    try {
      const res = await fetch(`/api/projects/${id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: newQuestion,
          category: newCategory || null,
          required: isRequired,
          order_index: questions.length,
          answer: newAnswer || null,
        }),
      });

      if (res.ok) {
        await fetchQuestions();
        setNewQuestion('');
        setNewCategory('');
        setNewAnswer('');
        setIsRequired(true);
      }
    } catch (error) {
      console.error('Failed to add question:', error);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/questions/${questionId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchQuestions();
      }
    } catch (error) {
      console.error('Failed to delete question:', error);
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

  const moveQuestion = async (questionId: string, direction: 'up' | 'down') => {
    const index = questions.findIndex(q => q.id === questionId);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === questions.length - 1)) {
      return;
    }

    const newQuestions = [...questions];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[swapIndex]] = [newQuestions[swapIndex], newQuestions[index]];
    
    setQuestions(newQuestions);
    setIsSaving(true);

    try {
      await fetch(`/api/projects/${id}/questions/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: newQuestions.map((q, i) => ({ id: q.id, order_index: i })),
        }),
      });
    } catch (error) {
      console.error('Failed to reorder questions:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const generateAIQuestions = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/projects/${id}/smart-questions`, {
        method: 'POST',
      });

      if (res.ok) {
        const result = await res.json();
        await fetchQuestions();
        alert(`Successfully extracted ${result.questionsAdded} questions from the RFI document and generated suggested answers!`);
      }
    } catch (error) {
      console.error('Failed to generate AI questions:', error);
      alert('Failed to generate questions. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadTemplate = async (templateName: string) => {
    const templates: Record<string, Array<{ question: string; category: string; required: boolean }>> = {
      voip: [
        { question: "What is your company's primary business and industry?", category: "Company Information", required: true },
        { question: "How long has your company been in business?", category: "Company Information", required: true },
        { question: "What VoIP solutions do you currently offer?", category: "Product Information", required: true },
        { question: "What are the key features of your VoIP platform?", category: "Product Information", required: true },
        { question: "How many concurrent calls can your system support?", category: "Technical Specifications", required: true },
        { question: "What codecs does your system support?", category: "Technical Specifications", required: false },
        { question: "Do you offer SIP trunking services?", category: "Services", required: true },
        { question: "What level of uptime do you guarantee?", category: "Service Level", required: true },
        { question: "What security measures are in place for your VoIP services?", category: "Security", required: true },
        { question: "Can you provide references from similar organizations?", category: "References", required: true },
      ],
    };

    const selectedTemplate = templates[templateName];
    if (selectedTemplate) {
      for (const item of selectedTemplate) {
        await fetch(`/api/projects/${id}/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_text: item.question,
            category: item.category,
            required: item.required,
            order_index: questions.length,
          }),
        });
      }
      await fetchQuestions();
    }
  };

  if (!project) {
    return <div className="min-h-screen bg-gray-50 p-8">Loading...</div>;
  }

  const groupedQuestions = questions.reduce((acc, question) => {
    const category = question.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(question);
    return acc;
  }, {} as Record<string, Question[]>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8">
          <Link href={`/project/${id}`} className="text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Project
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">RFI Response: {project.name}</h1>
          <p className="text-gray-600">Questions we need to answer as a vendor responding to this RFI</p>
        </div>

        {questions.length === 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Extract Questions from RFI Document</CardTitle>
              <CardDescription>Analyze the uploaded RFI to extract questions and generate answers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button 
                  onClick={generateAIQuestions} 
                  disabled={isGenerating}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {isGenerating ? 'Extracting & Generating...' : 'Extract Questions & Generate Answers'}
                </Button>
                <Button onClick={() => loadTemplate('voip')} variant="outline">
                  VoIP Template
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Questions will be extracted from the RFI document and answers generated from company knowledge
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Add Question & Answer Manually</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Question</label>
                <textarea
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={2}
                  placeholder="Enter the question from the RFI..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Answer</label>
                <textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={3}
                  placeholder="Enter your answer..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category (Optional)</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="e.g., Technical Requirements"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isRequired}
                      onChange={(e) => setIsRequired(e.target.checked)}
                      className="mr-2"
                    />
                    Required Question
                  </label>
                </div>
              </div>
              <Button onClick={addQuestion} disabled={!newQuestion.trim()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Question
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{category}</CardTitle>
                <CardDescription>{categoryQuestions.length} questions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {categoryQuestions.map((question, index) => (
                    <div key={question.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {question.question_text}
                            {question.required && <span className="text-red-500 ml-1">*</span>}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveQuestion(question.id, 'up')}
                          disabled={questions.findIndex(q => q.id === question.id) === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveQuestion(question.id, 'down')}
                          disabled={questions.findIndex(q => q.id === question.id) === questions.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteQuestion(question.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Answer section */}
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Our Answer:</label>
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
              </CardContent>
            </Card>
          ))}
        </div>

        {isSaving && (
          <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md flex items-center">
            <Save className="mr-2 h-4 w-4" />
            Saving...
          </div>
        )}
      </div>
    </div>
  );
}