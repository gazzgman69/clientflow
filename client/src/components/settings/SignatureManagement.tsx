import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { 
  Edit3, 
  Plus, 
  Trash2, 
  Star, 
  StarOff,
  Loader2
} from 'lucide-react';

interface EmailSignature {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SignatureManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSignature, setEditingSignature] = useState<EmailSignature | null>(null);
  const [formData, setFormData] = useState({ name: '', content: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current authenticated user
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    retry: false,
  });

  // Fetch signatures
  const { data: signatures = [], isLoading } = useQuery<EmailSignature[]>({
    queryKey: ['/api/signatures'],
    queryFn: async () => {
      const response = await fetch('/api/signatures', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch signatures');
      return response.json();
    },
    enabled: !!currentUser,
  });

  // Create signature mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; content: string; isDefault?: boolean }) => {
      const response = await apiRequest('POST', '/api/signatures', data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Signature created successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/signatures'] });
      setShowCreateForm(false);
      setFormData({ name: '', content: '' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to create signature',
        variant: 'destructive' 
      });
    }
  });

  // Update signature mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; content: string }) => {
      const response = await apiRequest('PUT', `/api/signatures/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Signature updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/signatures'] });
      setEditingSignature(null);
      setFormData({ name: '', content: '' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to update signature',
        variant: 'destructive' 
      });
    }
  });

  // Delete signature mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/signatures/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Signature deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/signatures'] });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to delete signature',
        variant: 'destructive' 
      });
    }
  });

  // Set default signature mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('POST', `/api/signatures/${id}/default`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Default signature updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/signatures'] });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to set default signature',
        variant: 'destructive' 
      });
    }
  });

  const handleCreate = () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast({ 
        title: 'Error', 
        description: 'Please fill in all fields',
        variant: 'destructive' 
      });
      return;
    }
    
    createMutation.mutate({
      ...formData,
      isDefault: signatures.length === 0 // Set as default if it's the first signature
    });
  };

  const handleEdit = (signature: EmailSignature) => {
    setEditingSignature(signature);
    setFormData({ name: signature.name, content: signature.content });
  };

  const handleUpdate = () => {
    if (!editingSignature || !formData.name.trim() || !formData.content.trim()) {
      toast({ 
        title: 'Error', 
        description: 'Please fill in all fields',
        variant: 'destructive' 
      });
      return;
    }
    
    updateMutation.mutate({
      id: editingSignature.id,
      ...formData
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the signature "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', content: '' });
    setShowCreateForm(false);
    setEditingSignature(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Email Signatures</h3>
          <p className="text-sm text-muted-foreground">
            Manage your email signatures for quick insertion into emails
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          data-testid="button-create-signature"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Signature
        </Button>
      </div>

      {/* Signatures List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      ) : signatures.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Edit3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Signatures</h3>
            <p className="text-gray-600 mb-4">
              Create your first email signature to get started
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Signature
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {signatures.map((signature) => (
            <Card key={signature.id} data-testid={`signature-card-${signature.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{signature.name}</h4>
                      {signature.isDefault && (
                        <Badge variant="default">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <div className="bg-gray-50 p-3 rounded border text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {signature.content}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Created: {new Date(signature.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {!signature.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(signature.id)}
                        disabled={setDefaultMutation.isPending}
                        data-testid={`button-set-default-${signature.id}`}
                      >
                        {setDefaultMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <StarOff className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(signature)}
                      data-testid={`button-edit-${signature.id}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(signature.id, signature.name)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${signature.id}`}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateForm || !!editingSignature} onOpenChange={resetForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSignature ? 'Edit Signature' : 'Create New Signature'}
            </DialogTitle>
            <DialogDescription>
              {editingSignature 
                ? 'Update your email signature details'
                : 'Create a new email signature for quick insertion into emails'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="signature-name">Signature Name</Label>
              <Input
                id="signature-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Professional, Personal, etc."
                data-testid="input-signature-name"
              />
            </div>
            
            <div>
              <Label htmlFor="signature-content">Signature Content</Label>
              <Textarea
                id="signature-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Enter your signature content..."
                rows={8}
                data-testid="textarea-signature-content"
              />
              <p className="text-xs text-muted-foreground mt-1">
                You can include your name, title, contact information, and any other details
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={resetForm}
                data-testid="button-cancel-signature"
              >
                Cancel
              </Button>
              <Button
                onClick={editingSignature ? handleUpdate : handleCreate}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-signature"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {editingSignature ? 'Update' : 'Create'} Signature
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}