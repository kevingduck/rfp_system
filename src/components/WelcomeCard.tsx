import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wand2, Zap, ArrowRight, FileText, MessageSquare, Sparkles } from 'lucide-react';

interface WelcomeCardProps {
  projectType: 'RFI' | 'RFP';
  onChooseWizard: () => void;
  onChooseQuick: () => void;
}

export function WelcomeCard({ projectType, onChooseWizard, onChooseQuick }: WelcomeCardProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-2 border-blue-100">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">Welcome to Your {projectType} Project!</CardTitle>
          <CardDescription className="text-base">
            Choose how you'd like to create your {projectType === 'RFI' ? 'Request for Information' : 'Request for Proposal'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Wizard Option */}
            <Card className="relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={onChooseWizard}>
              <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-3 py-1 rounded-bl-lg">
                Recommended
              </div>
              <CardHeader>
                <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                  <Wand2 className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-lg">Guided Wizard</CardTitle>
                <CardDescription>Perfect for first-time users or complex {projectType}s</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600 mb-4">
                  <li className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span>Step-by-step document upload</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span>AI asks clarifying questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span>Generates more targeted content</span>
                  </li>
                </ul>
                <Button className="w-full" onClick={(e) => { e.stopPropagation(); onChooseWizard(); }}>
                  Start Wizard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* Quick Generate Option */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onChooseQuick}>
              <CardHeader>
                <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                  <Zap className="h-6 w-6 text-gray-600" />
                </div>
                <CardTitle className="text-lg">Quick Generate</CardTitle>
                <CardDescription>For experienced users who know what they need</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-600 mb-4">
                  <li className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span>Upload all documents at once</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span>Skip the Q&A process</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span>Generate immediately</span>
                  </li>
                </ul>
                <Button variant="outline" className="w-full" onClick={(e) => { e.stopPropagation(); onChooseQuick(); }}>
                  Quick Generate
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              <strong>New to AI?</strong> We recommend starting with the Guided Wizard. 
              It helps ensure the AI understands your needs and creates better outputs.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}