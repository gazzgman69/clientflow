import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, FileText, Send, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertQuoteSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import type { Quote, Client, Contact } from "@shared/schema";
import { z } from "zod";

const quoteFormSchema = insertQuoteSchema.extend({
  subtotal: z.string().min(1, "Subtotal is required"),
  taxAmount: z.string().optional(),
  total: z.string().min(1, "Total is required"),
});

export default function Quotes() {
  // Check URL parameters for auto-actions
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  
  const [showQuoteModal, setShowQuoteModal] = useState(action === 'create');
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotes, isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: clients } = useQuery<Contact[]>({
    queryKey: ["/api/contacts?simple=1&limit=100"],
  });

  const form = useForm<z.infer<typeof quoteFormSchema>>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      title: "",
      description: "",
      subtotal: "",
      taxAmount: "",
      total: "",
      status: "draft",
      createdBy: "", // This would be set to current user
    },
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof quoteFormSchema>) => {
      const quoteData = {
        ...data,
        subtotal: parseFloat(data.subtotal),
        taxAmount: data.taxAmount ? parseFloat(data.taxAmount) : 0,
        total: parseFloat(data.total),
      };
      const response = await apiRequest("POST", "/api/quotes", quoteData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Success",
        description: "Quote created successfully!",
      });
      form.reset();
      setShowQuoteModal(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof quoteFormSchema>) => {
      const quoteData = {
        ...data,
        subtotal: parseFloat(data.subtotal),
        taxAmount: data.taxAmount ? parseFloat(data.taxAmount) : 0,
        total: parseFloat(data.total),
      };
      const response = await apiRequest("PATCH", `/api/quotes/${editingQuote!.id}`, quoteData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Success",
        description: "Quote updated successfully!",
      });
      form.reset();
      setEditingQuote(null);
      setShowQuoteModal(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await apiRequest("DELETE", `/api/quotes/${quoteId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pending-items"] });
      // Also invalidate contact-specific quotes cache
      if (quoteToDelete?.contactId) {
        queryClient.invalidateQueries({ queryKey: ["/api/contacts", quoteToDelete.contactId, "quotes"] });
      }
      toast({
        title: "Success",
        description: "Quote deleted successfully!",
      });
      setDeleteConfirmOpen(false);
      setQuoteToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Populate form when editing an existing quote
  useEffect(() => {
    if (editingQuote) {
      form.reset({
        title: editingQuote.title || "",
        description: editingQuote.description || "",
        subtotal: editingQuote.subtotal?.toString() || "",
        taxAmount: editingQuote.taxAmount?.toString() || "",
        total: editingQuote.total?.toString() || "",
        status: editingQuote.status || "draft",
        contactId: editingQuote.contactId || "",
        createdBy: editingQuote.createdBy || "",
      });
    }
  }, [editingQuote]);

  const onSubmit = (data: z.infer<typeof quoteFormSchema>) => {
    if (editingQuote) {
      updateQuoteMutation.mutate(data);
    } else {
      createQuoteMutation.mutate(data);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return '-';
    const client = clients?.find(c => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : 'Unknown Client';
  };

  const sendQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await apiRequest("POST", `/api/quotes/${quoteId}/send`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pending-items"] });
      toast({ title: "Quote sent", description: "The quote has been sent to the client." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send quote.", variant: "destructive" });
    },
  });

  const handleAddQuote = () => {
    setEditingQuote(null);
    form.reset();
    setShowQuoteModal(true);
  };

  const handleDeleteQuote = (quote: Quote) => {
    setQuoteToDelete(quote);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteQuote = () => {
    if (quoteToDelete) {
      deleteQuoteMutation.mutate(quoteToDelete.id);
    }
  };

  // Auto-calculate total when subtotal or tax changes
  const watchSubtotal = form.watch("subtotal");
  const watchTax = form.watch("taxAmount");

  const calculateTotal = () => {
    const subtotal = parseFloat(watchSubtotal || "0");
    const tax = parseFloat(watchTax || "0");
    const total = subtotal + tax;
    form.setValue("total", total.toFixed(2));
  };

  return (
    <>
      <Header 
        title="Quotes" 
        subtitle="Create and manage quotes for your clients"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <Card data-testid="quotes-table-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Quotes</CardTitle>
              <Button onClick={handleAddQuote} data-testid="button-add-quote">
                <Plus className="h-4 w-4 mr-2" />
                Create Quote
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
            ) : !quotes || quotes.length === 0 ? (
              <div className="text-center py-12" data-testid="empty-quotes-state">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No quotes found</p>
                <Button onClick={handleAddQuote} data-testid="button-add-first-quote">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Quote
                </Button>
              </div>
            ) : (
              <Table data-testid="quotes-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotes.map((quote) => (
                    <TableRow key={quote.id} data-testid={`quote-row-${quote.id}`}>
                      <TableCell className="font-medium" data-testid={`quote-number-${quote.id}`}>
                        {quote.quoteNumber}
                      </TableCell>
                      <TableCell data-testid={`quote-title-${quote.id}`}>
                        {quote.title}
                      </TableCell>
                      <TableCell data-testid={`quote-client-${quote.id}`}>
                        {getClientName(quote.clientId)}
                      </TableCell>
                      <TableCell data-testid={`quote-amount-${quote.id}`}>
                        {formatCurrency(parseFloat(quote.total || '0'), ((quote as any).currency as any) || 'GBP')}
                      </TableCell>
                      <TableCell data-testid={`quote-status-${quote.id}`}>
                        <Badge className={getStatusColor(quote.status)}>
                          {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`quote-created-${quote.id}`}>
                        {formatDistanceToNow(new Date(quote.createdAt!), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" data-testid={`send-quote-${quote.id}`} onClick={() => sendQuoteMutation.mutate(quote.id)} disabled={quote.status !== 'draft'}>
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`edit-quote-${quote.id}`} onClick={() => { setEditingQuote(quote); setShowQuoteModal(true); }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteQuote(quote)}
                            data-testid={`delete-quote-${quote.id}`}
                          >
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

      {/* Add/Edit Quote Modal */}
      <Dialog open={showQuoteModal} onOpenChange={setShowQuoteModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingQuote ? 'Edit Quote' : 'Create New Quote'}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quote Title *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-quote-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-quote-client">
                          <SelectValue placeholder="Select a client..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.firstName} {client.lastName} {client.company && `(${client.company})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        rows={3} 
                        placeholder="Quote description..." 
                        {...field} 
                        value={field.value || ""}
                        data-testid="textarea-quote-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="subtotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtotal *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          step="0.01"
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            calculateTotal();
                          }}
                          data-testid="input-quote-subtotal" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="taxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax Amount</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          step="0.01"
                          {...field}
                          onBlur={() => {
                            field.onBlur();
                            calculateTotal();
                          }}
                          data-testid="input-quote-tax" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          step="0.01"
                          {...field}
                          readOnly
                          data-testid="input-quote-total" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex items-center justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setShowQuoteModal(false)}
                  data-testid="button-cancel-quote"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createQuoteMutation.isPending || updateQuoteMutation.isPending}
                  data-testid="button-save-quote"
                >
                  {editingQuote
                    ? (updateQuoteMutation.isPending ? "Saving..." : "Save Changes")
                    : (createQuoteMutation.isPending ? "Creating..." : "Create Quote")}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Quote
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this quote? This action cannot be undone.
              {quoteToDelete && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <p className="font-medium">{quoteToDelete.title}</p>
                  <p className="text-sm text-muted-foreground">
                    Quote #{quoteToDelete.quoteNumber} • {formatCurrency(parseFloat(quoteToDelete.total || '0'), ((quoteToDelete as any).currency as any) || 'GBP')}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setDeleteConfirmOpen(false);
                setQuoteToDelete(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteQuote}
              disabled={deleteQuoteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              {deleteQuoteMutation.isPending ? "Deleting..." : "Delete Quote"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
