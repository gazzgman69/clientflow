import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, File, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Contract, Contact } from "@shared/schema";
import CreateContractDialog from "@/components/contracts/create-contract-dialog";
import { useLocation } from "wouter";

export default function Contracts() {
  const [showContractModal, setShowContractModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Check for URL parameters to edit a template
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const templateId = params.get('templateId');
    
    if (action === 'edit' && templateId) {
      setEditingTemplateId(templateId);
      setShowContractModal(true);
      // Clear the URL parameters
      window.history.replaceState({}, '', '/contracts');
    }
  }, []);

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts?simple=1&limit=100"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'awaiting_counter_signature': return 'bg-yellow-100 text-yellow-800';
      case 'signed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getContactName = (contactId: string) => {
    if (!Array.isArray(contacts)) return 'Unknown Contact';
    const contact = contacts.find(c => c.id === contactId);
    return contact ? `${contact.firstName} ${contact.lastName}` : 'Unknown Contact';
  };

  return (
    <>
      <Header 
        title="Contracts" 
        subtitle="Manage client contracts and agreements"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <Card data-testid="contracts-table-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Contracts</CardTitle>
              <Button onClick={() => setShowContractModal(true)} data-testid="button-add-contract">
                <Plus className="h-4 w-4 mr-2" />
                Create Contract
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted rounded"></div>
                  ))}
                </div>
              </div>
            ) : !contracts || contracts.length === 0 ? (
              <div className="text-center py-12" data-testid="empty-contracts-state">
                <File className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No contracts found</p>
                <Button onClick={() => setShowContractModal(true)} data-testid="button-add-first-contract">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Contract
                </Button>
              </div>
            ) : (
              <Table data-testid="contracts-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id} data-testid={`contract-row-${contract.id}`}>
                      <TableCell className="font-medium" data-testid={`contract-title-${contract.id}`}>
                        {contract.displayTitle || contract.title}
                      </TableCell>
                      <TableCell data-testid={`contract-contact-${contract.id}`}>
                        {getContactName(contract.contactId)}
                      </TableCell>
                      <TableCell data-testid={`contract-status-${contract.id}`}>
                        <Badge className={getStatusColor(contract.status)}>
                          {contract.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`contract-workflow-${contract.id}`}>
                        <span className="text-xs text-muted-foreground">
                          {contract.signatureWorkflow?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`contract-created-${contract.id}`}>
                        {formatDistanceToNow(new Date(contract.createdAt!), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" data-testid={`send-contract-${contract.id}`} onClick={() => setLocation(`/contracts/${contract.id}/preview`)}>
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`edit-contract-${contract.id}`} onClick={() => setLocation(`/contracts/${contract.id}/preview`)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`delete-contract-${contract.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <CreateContractDialog 
        open={showContractModal} 
        onOpenChange={(open) => {
          setShowContractModal(open);
          if (!open) {
            setEditingTemplateId(null);
          }
        }}
        templateId={editingTemplateId}
      />
    </>
  );
}
