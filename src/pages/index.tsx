import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Plus, Upload, Globe, Download, Settings, Archive, Trash2, RotateCcw } from 'lucide-react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  project_type: 'RFI' | 'RFP';
  organization_name?: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [projectType, setProjectType] = useState<'RFI' | 'RFP'>('RFI');
  const [projectFilter, setProjectFilter] = useState<'all' | 'active' | 'archived'>('active');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      // Check if data is an array, if not (error response), set empty array
      if (Array.isArray(data)) {
        setProjects(data);
      } else {
        console.error('Failed to fetch projects:', data.error || 'Unknown error');
        setProjects([]);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    }
  };

  const createProject = async () => {
    if (!newProjectName) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName,
          projectType,
          organizationName: organizationName || undefined,
        }),
      });

      if (res.ok) {
        await fetchProjects();
        setNewProjectName('');
        setOrganizationName('');
        setProjectType('RFI');
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const archiveProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to archive this project?')) return;

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });

      if (res.ok) {
        fetchProjects();
      }
    } catch (error) {
      console.error('Failed to archive project:', error);
    }
  };

  const restoreProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore' }),
      });

      if (res.ok) {
        fetchProjects();
      }
    } catch (error) {
      console.error('Failed to restore project:', error);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        fetchProjects();
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  // Filter projects based on the selected filter
  const filteredProjects = projects.filter(project => {
    if (projectFilter === 'all') return true;
    if (projectFilter === 'archived') return project.archived_at !== null;
    if (projectFilter === 'active') return project.archived_at === null;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">RFI/RFP Management System</h1>
            <p className="text-gray-600">Create and manage RFIs and RFPs with AI-powered assistance</p>
          </div>
          <Link href="/settings">
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Company Settings
            </Button>
          </Link>
        </div>

        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {!isCreating ? (
                <Button onClick={() => setIsCreating(true)} size="lg">
                  <Plus className="mr-2 h-5 w-5" />
                  New Project
                </Button>
              ) : null}
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={projectFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setProjectFilter('active')}
              >
                Active
              </Button>
              <Button
                variant={projectFilter === 'archived' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setProjectFilter('archived')}
              >
                Archived
              </Button>
              <Button
                variant={projectFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setProjectFilter('all')}
              >
                All
              </Button>
            </div>
          </div>
          
          {isCreating ? (
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Create New Project</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Project Type</label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="RFI"
                          checked={projectType === 'RFI'}
                          onChange={(e) => setProjectType(e.target.value as 'RFI' | 'RFP')}
                          className="mr-2"
                        />
                        RFI (Request for Information)
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="RFP"
                          checked={projectType === 'RFP'}
                          onChange={(e) => setProjectType(e.target.value as 'RFI' | 'RFP')}
                          className="mr-2"
                        />
                        RFP (Request for Proposal)
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Project Name</label>
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder={projectType === 'RFI' ? "e.g., VoIP Market Research RFI" : "e.g., State of Indiana VoIP RFP"}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Client Organization (Optional)</label>
                    <p className="text-xs text-gray-600 mb-1">The organization that sent you this {projectType}</p>
                    <input
                      type="text"
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="e.g., State of Indiana, Acme Corp"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={createProject}>Create Project</Button>
                    <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className={`hover:shadow-lg transition-shadow ${project.archived_at ? 'opacity-60' : ''}`}>
              <Link href={`/project/${project.id}`}>
                <CardHeader className="cursor-pointer">
                  <CardTitle className="flex items-center">
                    <FileText className="mr-2 h-5 w-5" />
                    <span className="text-xs font-normal bg-gray-200 px-2 py-1 rounded mr-2">{project.project_type}</span>
                    {project.name}
                  </CardTitle>
                  {project.organization_name && (
                    <CardDescription>Client: {project.organization_name}</CardDescription>
                  )}
                </CardHeader>
              </Link>
              <CardContent>
                <div className="text-sm text-gray-600 mb-4">
                  <p>Status: <span className="font-medium capitalize">{project.status}</span></p>
                  <p>Created: {new Date(project.created_at).toLocaleDateString()}</p>
                  {project.archived_at && (
                    <p className="text-orange-600">Archived: {new Date(project.archived_at).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {project.archived_at ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          restoreProject(project.id);
                        }}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Restore
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          deleteProject(project.id);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        archiveProject(project.id);
                      }}
                    >
                      <Archive className="mr-1 h-3 w-3" />
                      Archive
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {projects.length === 0 && !isCreating && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No projects yet. Create your first RFI or RFP!</p>
          </div>
        )}
      </div>
    </div>
  );
}