import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Filter, Download, Send, Check, FileText, File, Receipt, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/currency";
import type { Quote, Contract, Invoice, Contact } from "@shared/schema";

interface Document {
  id: string;
  title: string;
  status: string;
  contactId: string;
  clientId?: string; // legacy alias
  total?: number;
  amount?: number;
  createdAt: string;
  sentAt?: string;
  documentType: 'quote' | 'contract' | 'invoice';
}

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Build documents URL with proper query params
  const documentsUrl = (() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    const qs = params.toString();
    return qs ? `/api/documents?${qs}` : "/api/documents";
  })();

  // Fetch all documents
  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: [documentsUrl],
  });

  // Fetch contacts for name display
  const { data: clients = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts?simple=1&limit=100"],
  });

  // Status change mutations
  const sendDocumentMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const response = await apiRequest("POST", `/api/${type}s/${id}/send`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document sent successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const approveDocumentMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const endpoint = type === 'quote' ? 'approve' : type === 'contract' ? 'sign' : 'pay';
      const response = await apiRequest("POST", `/api/${type}s/${id}/${endpoint}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document status updated successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update document status. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const response = await apiRequest("DELETE", `/api/${type}s/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document deleted successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete document. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter documents based on search and filters
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getClientName(doc.contactId ?? doc.clientId ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    const matchesType = typeFilter === "all" || doc.documentType === typeFilter.replace('s', '');
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : "Unknown Client";
  };

  const getStatusColor = (status: string, type: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'sent': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'approved': 
      case 'signed':
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
      case 'cancelled':
      case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'expired': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'quote': return <FileText className="h-4 w-4" />;
      case 'contract': return <File className="h-4 w-4" />;
      case 'invoice': return <Receipt className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getDocumentAmount = (doc: Document) => {
    const amount = doc.total || doc.amount || 0;
    return formatCurrency(typeof amount === 'string' ? parseFloat(amount) : amount, (doc as any).currency || 'GBP');
  };

  const canSend = (doc: Document) => doc.status === 'draft';
  const canApprove = (doc: Document) => 
    (doc.documentType === 'quote' && doc.status === 'sent') ||
    (doc.documentType === 'contract' && doc.status === 'sent') ||
    (doc.documentType === 'invoice' && doc.status === 'sent');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground">Manage all your quotes, contracts, and invoices in one place</p>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Filters and Search */}
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search documents by title or client name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-documents"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32" data-testid="select-document-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="quotes">Quotes</SelectItem>
                  <SelectItem value="contracts">Contracts</SelectItem>
                  <SelectItem value="invoices">Invoices</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32" data-testid="select-document-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="signed">Signed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="icon" data-testid="button-export-documents">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Documents Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading documents...
                  </TableCell>
                </TableRow>
              ) : filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No documents found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map((doc) => (
                  <TableRow key={`${doc.documentType}-${doc.id}`} data-testid={`row-document-${doc.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                          {getDocumentIcon(doc.documentType)}
                        </div>
                        <div>
                          <div className="font-medium" data-testid={`text-document-title-${doc.id}`}>
                            {doc.title}
                          </div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {doc.documentType}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-client-${doc.id}`}>
                      {getClientName(doc.contactId ?? doc.clientId ?? "")}
                    </TableCell>
                    <TableCell data-testid={`text-amount-${doc.id}`}>
                      {getDocumentAmount(doc)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={getStatusColor(doc.status, doc.documentType)}
                        data-testid={`badge-status-${doc.id}`}
                      >
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-created-${doc.id}`}>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell data-testid={`text-sent-${doc.id}`}>
                      {doc.sentAt ? new Date(doc.sentAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canSend(doc) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendDocumentMutation.mutate({ id: doc.id, type: doc.documentType })}
                            disabled={sendDocumentMutation.isPending}
                            data-testid={`button-send-${doc.id}`}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Send
                          </Button>
                        )}
                        
                        {canApprove(doc) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveDocumentMutation.mutate({ id: doc.id, type: doc.documentType })}
                            disabled={approveDocumentMutation.isPending}
                            data-testid={`button-approve-${doc.id}`}
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {doc.documentType === 'quote' ? 'Approve' : 
                             doc.documentType === 'contract' ? 'Sign' : 'Mark Paid'}
                          </Button>
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              data-testid={`button-actions-${doc.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedDocument(doc);
                                setShowPreviewModal(true);
                              }}
                              data-testid={`action-view-${doc.id}`}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid={`action-edit-${doc.id}`} onClick={() => { setSelectedDocument(doc); }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteDocumentMutation.mutate({ id: doc.id, type: doc.documentType })}
                              className="text-destructive"
                              data-testid={`action-delete-${doc.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
      
      {/* Document Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDocument && (
                <div className="flex items-center gap-2">
                  {getDocumentIcon(selectedDocument.documentType)}
                  {selectedDocument.title}
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <p className="capitalize">{selectedDocument.documentType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className={getStatusColor(selectedDocument.status, selectedDocument.documentType)}>
                    {selectedDocument.status}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Client</label>
                  <p>{getClientName(selectedDocument.contactId ?? selectedDocument.clientId ?? "")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <p>{getDocumentAmount(selectedDocument)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p>{new Date(selectedDocument.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Sent</label>
                  <p>{selectedDocument.sentAt ? new Date(selectedDocument.sentAt).toLocaleDateString() : 'Not sent'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}