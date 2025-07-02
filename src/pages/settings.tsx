import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Building2, Phone, Mail, Globe, FileText, Award, Users, Briefcase, Download, Loader2, BookOpen, Upload, Trash2 } from 'lucide-react';

interface CompanyInfo {
  company_name: string;
  description: string;
  services: string;
  capabilities: string;
  differentiators: string;
  experience: string;
  certifications: string;
  team_size: string;
  website: string;
  email: string;
  phone: string;
  address: string;
}

interface KnowledgeFile {
  id: number;
  category: string;
  filename: string;
  original_filename: string;
  uploaded_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    company_name: '',
    description: '',
    services: '',
    capabilities: '',
    differentiators: '',
    experience: '',
    certifications: '',
    team_size: '',
    website: '',
    email: '',
    phone: '',
    address: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [isUploadingKnowledge, setIsUploadingKnowledge] = useState(false);

  useEffect(() => {
    fetchCompanyInfo();
    fetchKnowledgeFiles();
  }, []);

  const fetchCompanyInfo = async () => {
    try {
      const res = await fetch('/api/company-info');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setCompanyInfo(data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch company info:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('Saving...');
    
    try {
      const res = await fetch('/api/company-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyInfo),
      });

      if (res.ok) {
        setSaveStatus('Saved successfully!');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        setSaveStatus('Failed to save');
      }
    } catch (error) {
      console.error('Save failed:', error);
      setSaveStatus('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof CompanyInfo, value: string) => {
    setCompanyInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleImportFromWebsite = async () => {
    setIsImporting(true);
    setImportStatus('Importing from www.convergednetworks.com...');
    
    try {
      // First, set the company name and website
      setCompanyInfo(prev => ({ 
        ...prev, 
        company_name: 'Converged Networks',
        website: 'www.convergednetworks.com'
      }));

      // Scrape the website
      const scrapeRes = await fetch('/api/company-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.convergednetworks.com' }),
      });

      if (scrapeRes.ok) {
        const importedData = await scrapeRes.json();
        
        // Update company info with imported data
        setCompanyInfo(prev => ({
          ...prev,
          ...importedData,
          company_name: 'Converged Networks', // Always keep this
          website: 'www.convergednetworks.com' // Always keep this
        }));
        
        setImportStatus('Successfully imported company information!');
        setTimeout(() => setImportStatus(''), 5000);
      } else {
        setImportStatus('Failed to import. Please fill in manually.');
      }
    } catch (error) {
      console.error('Import failed:', error);
      setImportStatus('Import failed. Please fill in manually.');
    } finally {
      setIsImporting(false);
    }
  };

  const fetchKnowledgeFiles = async () => {
    try {
      const res = await fetch('/api/company-knowledge');
      if (res.ok) {
        const files = await res.json();
        // Ensure files is an array
        setKnowledgeFiles(Array.isArray(files) ? files : []);
      } else {
        console.error('Failed to fetch knowledge files:', res.status);
        setKnowledgeFiles([]);
      }
    } catch (error) {
      console.error('Failed to fetch knowledge files:', error);
      setKnowledgeFiles([]);
    }
  };

  const handleKnowledgeUpload = async (file: File, category: string) => {
    setIsUploadingKnowledge(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    try {
      const res = await fetch('/api/company-knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await fetchKnowledgeFiles();
      } else {
        console.error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploadingKnowledge(false);
    }
  };

  const handleKnowledgeDelete = async (fileId: number) => {
    try {
      const res = await fetch(`/api/company-knowledge/${fileId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchKnowledgeFiles();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => router.push('/')}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Projects
          </Button>
          
          <h1 className="text-3xl font-bold text-gray-900">Company Settings</h1>
          <p className="text-gray-600 mt-2">
            Configure your company information to generate better RFIs and RFPs
          </p>
        </div>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Your company's basic details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium">Company Name</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImportFromWebsite}
                    disabled={isImporting}
                    className="text-xs"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-3 w-3" />
                        Import from Converged Networks
                      </>
                    )}
                  </Button>
                </div>
                <input
                  type="text"
                  value={companyInfo.company_name}
                  onChange={(e) => handleChange('company_name', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Acme VoIP Solutions"
                />
                {importStatus && (
                  <p className={`text-sm mt-1 ${importStatus.includes('Success') ? 'text-green-600' : 'text-amber-600'}`}>
                    {importStatus}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Company Description</label>
                <textarea
                  value={companyInfo.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md h-24"
                  placeholder="We are a leading provider of enterprise VoIP and unified communications solutions..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Team Size</label>
                  <input
                    type="text"
                    value={companyInfo.team_size}
                    onChange={(e) => handleChange('team_size', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="50-100 employees"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Years of Experience</label>
                  <input
                    type="text"
                    value={companyInfo.experience}
                    onChange={(e) => handleChange('experience', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="15+ years in VoIP"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Services & Capabilities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Briefcase className="mr-2 h-5 w-5" />
                Services & Capabilities
              </CardTitle>
              <CardDescription>
                What you offer and how you deliver
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Services Offered</label>
                <textarea
                  value={companyInfo.services}
                  onChange={(e) => handleChange('services', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md h-32"
                  placeholder="• Cloud-based VoIP systems&#10;• SIP trunking services&#10;• Unified Communications (UC)&#10;• Video conferencing solutions&#10;• Call center solutions&#10;• VoIP hardware and phones&#10;• Network assessment and design&#10;• 24/7 support and monitoring"
                />
                <p className="text-xs text-gray-500 mt-1">List your main services, one per line</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Technical Capabilities</label>
                <textarea
                  value={companyInfo.capabilities}
                  onChange={(e) => handleChange('capabilities', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md h-32"
                  placeholder="• Multi-vendor platform expertise (Cisco, Avaya, Mitel, etc.)&#10;• Cloud and on-premise deployments&#10;• Hybrid solutions&#10;• API integrations&#10;• Custom development&#10;• Migration services&#10;• Disaster recovery planning&#10;• Quality of Service (QoS) optimization"
                />
                <p className="text-xs text-gray-500 mt-1">Technical skills and implementation capabilities</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Key Differentiators</label>
                <textarea
                  value={companyInfo.differentiators}
                  onChange={(e) => handleChange('differentiators', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md h-24"
                  placeholder="What makes your company unique? Why should clients choose you?"
                />
              </div>
            </CardContent>
          </Card>

          {/* Certifications & Credentials */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Award className="mr-2 h-5 w-5" />
                Certifications & Credentials
              </CardTitle>
              <CardDescription>
                Industry certifications and partnerships
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <label className="block text-sm font-medium mb-1">Certifications & Partnerships</label>
                <textarea
                  value={companyInfo.certifications}
                  onChange={(e) => handleChange('certifications', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md h-24"
                  placeholder="• Cisco Gold Partner&#10;• Microsoft Teams Certified&#10;• ISO 9001:2015 Certified&#10;• PCI DSS Compliant&#10;• HIPAA Compliant"
                />
                <p className="text-xs text-gray-500 mt-1">List certifications, partnerships, and compliance standards</p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Phone className="mr-2 h-5 w-5" />
                Contact Information
              </CardTitle>
              <CardDescription>
                How clients can reach you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <Mail className="inline h-4 w-4 mr-1" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={companyInfo.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="sales@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <Phone className="inline h-4 w-4 mr-1" />
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={companyInfo.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  <Globe className="inline h-4 w-4 mr-1" />
                  Website
                </label>
                <input
                  type="url"
                  value={companyInfo.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="https://www.company.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <textarea
                  value={companyInfo.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md h-20"
                  placeholder="123 Business Ave&#10;Suite 100&#10;City, State 12345"
                />
              </div>
            </CardContent>
          </Card>

          {/* Knowledge Base */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="mr-2 h-5 w-5" />
                Company Knowledge Base
              </CardTitle>
              <CardDescription>
                Upload key documents to train the AI on your company's expertise
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Knowledge Categories */}
                <div className="grid grid-cols-2 gap-4">
                  <KnowledgeCategory
                    title="Won Proposals"
                    description="10-15 recent winning proposals"
                    category="won_proposals"
                    accept=".pdf,.doc,.docx"
                    onUpload={handleKnowledgeUpload}
                    files={knowledgeFiles.filter(f => f.category === 'won_proposals')}
                    onDelete={handleKnowledgeDelete}
                  />
                  <KnowledgeCategory
                    title="Scopes of Work"
                    description="Standard SOWs for each service"
                    category="sow"
                    accept=".pdf,.doc,.docx"
                    onUpload={handleKnowledgeUpload}
                    files={knowledgeFiles.filter(f => f.category === 'sow')}
                    onDelete={handleKnowledgeDelete}
                  />
                  <KnowledgeCategory
                    title="K-12 / E-Rate Docs"
                    description="Form 470s & CIPA guides"
                    category="k12_erate"
                    accept=".pdf,.doc,.docx"
                    onUpload={handleKnowledgeUpload}
                    files={knowledgeFiles.filter(f => f.category === 'k12_erate')}
                    onDelete={handleKnowledgeDelete}
                  />
                  <KnowledgeCategory
                    title="Engineering Checklists"
                    description="Technical checklists & guides"
                    category="engineering"
                    accept=".pdf,.doc,.docx,.xlsx,.xls"
                    onUpload={handleKnowledgeUpload}
                    files={knowledgeFiles.filter(f => f.category === 'engineering')}
                    onDelete={handleKnowledgeDelete}
                  />
                  <KnowledgeCategory
                    title="Project Plans"
                    description="Sample project timelines"
                    category="project_plans"
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.mpp"
                    onUpload={handleKnowledgeUpload}
                    files={knowledgeFiles.filter(f => f.category === 'project_plans')}
                    onDelete={handleKnowledgeDelete}
                  />
                  <KnowledgeCategory
                    title="Legal Agreements"
                    description="MSA & standard contracts"
                    category="legal"
                    accept=".pdf,.doc,.docx"
                    onUpload={handleKnowledgeUpload}
                    files={knowledgeFiles.filter(f => f.category === 'legal')}
                    onDelete={handleKnowledgeDelete}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end items-center gap-4">
            {saveStatus && (
              <span className={`text-sm ${saveStatus.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                {saveStatus}
              </span>
            )}
            <Button onClick={handleSave} disabled={isSaving} size="lg">
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Company Info'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Knowledge Category Component
function KnowledgeCategory({ 
  title, 
  description, 
  category, 
  accept, 
  onUpload, 
  files, 
  onDelete 
}: {
  title: string;
  description: string;
  category: string;
  accept: string;
  onUpload: (file: File, category: string) => void;
  files: KnowledgeFile[];
  onDelete: (fileId: number) => void;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file, category);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div>
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      
      <div className="space-y-2">
        {files.map(file => (
          <div key={file.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
            <span className="truncate flex-1">{file.original_filename}</span>
            <button
              onClick={() => onDelete(file.id)}
              className="text-red-600 hover:text-red-700 ml-2"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div>
        <input
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
          id={`upload-${category}`}
        />
        <label htmlFor={`upload-${category}`}>
          <Button variant="outline" size="sm" className="w-full" asChild>
            <span>
              <Upload className="h-3 w-3 mr-2" />
              Upload
            </span>
          </Button>
        </label>
      </div>
    </div>
  );
}