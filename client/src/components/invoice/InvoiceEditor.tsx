import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, addDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, CalendarIcon, Plus, Save, Send, Trash2, FileText, DollarSign, Receipt } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Invoice, InvoiceItem, Contact, TaxSettings } from "@shared/schema";
import { z } from "zod";
import { formatCurrency } from "@/lib/currency";

const invoiceEditorSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  projectId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  issueDate: z.date(),
  dueDate: z.date(),
  currency: z.string().default("GBP"),
  status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]).default("draft"),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

type InvoiceEditorForm = z.infer<typeof invoiceEditorSchema>;

interface InvoiceEditorProps {
  isOpen: boolean;
  onClose: () => void;
  contactId?: string;
  contactName?: string;
  editingInvoice?: Invoice | null;
  projectId?: string;
  onContactSelect?: (contactId: string, contactName: string) => void;
}

interface LineItem {
  invoiceItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  displayOrder: number;
}

const CURRENCY_OPTIONS = [
  { value: "GBP", label: "£ GBP", symbol: "£" },
  { value: "USD", label: "$ USD", symbol: "$" },
  { value: "EUR", label: "€ EUR", symbol: "€" },
];

export default function InvoiceEditor({ 
  isOpen, 
  onClose, 
  contactId: initialContactId, 
  contactName: initialContactName,
  editingInvoice,
  projectId,
  onContactSelect
}: InvoiceEditorProps) {
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [contactInfo, setContactInfo] = useState({ id: initialContactId || "", name: initialContactName || "" });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItemsForAdding, setSelectedItemsForAdding] = useState<Set<string>>(new Set());
  const [showItemsDialog, setShowItemsDialog] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update contactInfo when props change
  useEffect(() => {
    setContactInfo({ 
      id: initialContactId || "", 
      name: initialContactName || "" 
    });
  }, [initialContactId, initialContactName]);

  // Method to update contact information
  const updateContactInfo = (contactId: string, contactName: string) => {
    setContactInfo({ id: contactId, name: contactName });
    form.setValue('contactId', contactId);
    if (onContactSelect) {
      onContactSelect(contactId, contactName);
    }
  };

  // Form setup
  const form = useForm<InvoiceEditorForm>({
    resolver: zodResolver(invoiceEditorSchema),
    defaultValues: {
      contactId: contactInfo.id,
      projectId: projectId,
      title: "",
      description: "",
      issueDate: new Date(),
      dueDate: addDays(new Date(), 30),
      currency: "GBP",
      status: "draft",
      notes: "",
      terms: "",
    },
  });

  // Fetch invoice items (Products & Services)
  const { data: invoiceItems = [] } = useQuery<InvoiceItem[]>({
    queryKey: ["/api/invoice-items"],
  });

  // Fetch tax settings
  const { data: taxSettings } = useQuery<TaxSettings>({
    queryKey: ["/api/tax-settings"],
  });

  // Fetch contacts for the contact picker
  const { data: contactsData } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });
  const contacts = Array.isArray(contactsData) ? contactsData : [];

  // Load existing invoice data when editing
  useEffect(() => {
    if (editingInvoice && isOpen) {
      form.reset({
        contactId: editingInvoice.contactId || "",
        projectId: editingInvoice.projectId || undefined,
        title: editingInvoice.title || "",
        description: editingInvoice.description || "",
        issueDate: editingInvoice.issueDate ? new Date(editingInvoice.issueDate) : new Date(),
        dueDate: editingInvoice.dueDate ? new Date(editingInvoice.dueDate) : addDays(new Date(), 30),
        currency: editingInvoice.currency || "GBP",
        status: editingInvoice.status || "draft",
        notes: editingInvoice.notes || "",
        terms: editingInvoice.terms || "",
      });

      // Load line items for existing invoice
      if (editingInvoice.id) {
        queryClient.fetchQuery({
          queryKey: ["/api/invoices", editingInvoice.id, "line-items"],
        }).then((items: any) => {
          if (items) {
            setLineItems(items.map((item: any) => ({
              invoiceItemId: item.invoiceItemId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              displayOrder: item.displayOrder,
            })));
          }
        });
      }

      // Find and set contact name
      const contact = contacts.find(c => c.id === editingInvoice.contactId);
      if (contact) {
        setContactInfo({ id: contact.id, name: contact.name || contact.email });
      }
    } else if (isOpen && !editingInvoice) {
      // Reset form for new invoice
      form.reset({
        contactId: contactInfo.id,
        projectId: projectId,
        title: "",
        description: "",
        issueDate: new Date(),
        dueDate: addDays(new Date(), 30),
        currency: "GBP",
        status: "draft",
        notes: "",
        terms: "",
      });
      setLineItems([]);
    }
  }, [editingInvoice, isOpen, contacts, projectId]);

  // Add selected items to line items
  const handleAddItems = () => {
    const newItems: LineItem[] = [];
    selectedItemsForAdding.forEach(itemId => {
      const item = invoiceItems.find(i => i.id === itemId);
      if (item) {
        newItems.push({
          invoiceItemId: item.id,
          description: item.description || item.name,
          quantity: 1,
          unitPrice: item.unitPrice,
          displayOrder: lineItems.length + newItems.length,
        });
      }
    });

    setLineItems([...lineItems, ...newItems]);
    setSelectedItemsForAdding(new Set());
    setShowItemsDialog(false);
    
    toast({
      title: "Items added",
      description: `${newItems.length} item${newItems.length !== 1 ? 's' : ''} added to invoice`,
    });
  };

  // Remove line item
  const handleRemoveItem = (index: number) => {
    const newItems = lineItems.filter((_, i) => i !== index);
    // Reorder display order
    const reordered = newItems.map((item, idx) => ({
      ...item,
      displayOrder: idx,
    }));
    setLineItems(reordered);
  };

  // Update line item
  const handleUpdateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setLineItems(newItems);
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxRate = taxSettings?.rate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, taxRate, total };
  };

  const { subtotal, taxAmount, taxRate, total } = calculateTotals();

  // Save invoice mutation
  const saveInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceEditorForm & { sendToContact?: boolean }) => {
      const { sendToContact, ...invoiceData } = data;
      
      const payload = {
        ...invoiceData,
        subtotal,
        taxAmount,
        total,
        issueDate: invoiceData.issueDate.toISOString(),
        dueDate: invoiceData.dueDate.toISOString(),
      };

      let invoice;
      if (editingInvoice?.id) {
        invoice = await apiRequest("PATCH", `/api/invoices/${editingInvoice.id}`, payload);
      } else {
        invoice = await apiRequest("POST", "/api/invoices", payload);
      }

      // Save line items
      if (invoice.id && lineItems.length > 0) {
        await apiRequest("POST", `/api/invoices/${invoice.id}/line-items`, lineItems);
      }

      return { invoice, sendToContact };
    },
    onSuccess: ({ invoice, sendToContact }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoice.id] });
      
      toast({
        title: sendToContact ? "Invoice sent" : "Invoice saved",
        description: sendToContact 
          ? `Invoice sent to ${contactInfo.name}` 
          : `Invoice #${invoice.invoiceNumber || invoice.id} has been saved`,
      });
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save invoice",
        variant: "destructive",
      });
    },
  });

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!editingInvoice?.id) return;
      await apiRequest("DELETE", `/api/invoices/${editingInvoice.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({
        title: "Invoice deleted",
        description: "The invoice has been deleted successfully",
      });
      setShowDeleteDialog(false);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete invoice",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InvoiceEditorForm, sendToContact = false) => {
    if (lineItems.length === 0) {
      toast({
        title: "No items",
        description: "Please add at least one item to the invoice",
        variant: "destructive",
      });
      return;
    }

    saveInvoiceMutation.mutate({ ...data, sendToContact });
  };

  const selectedCurrency = CURRENCY_OPTIONS.find(c => c.value === form.watch("currency"));

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {editingInvoice ? "Edit Invoice" : "Create New Invoice"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => onSubmit(data, false))} className="space-y-6">
              {/* Contact Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="contactId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact *</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            const contact = contacts.find(c => c.id === value);
                            if (contact) {
                              updateContactInfo(value, contact.name || contact.email);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-contact">
                              <SelectValue placeholder="Select a contact" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {contacts.map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.name || contact.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {contactInfo.name && (
                    <div className="text-sm text-muted-foreground">
                      Invoice will be sent to: <strong>{contactInfo.name}</strong>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Invoice Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title *</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="e.g., DJ Services - Wedding Reception"
                              data-testid="input-title"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-currency">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CURRENCY_OPTIONS.map(currency => (
                                <SelectItem key={currency.value} value={currency.value}>
                                  {currency.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Add additional details about this invoice..."
                            rows={3}
                            data-testid="textarea-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="issueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Issue Date *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  data-testid="button-issue-date"
                                >
                                  {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  data-testid="button-due-date"
                                >
                                  {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                              <SelectItem value="overdue">Overdue</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Items</CardTitle>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowItemsDialog(true)}
                      data-testid="button-add-items"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Items
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {lineItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No items added yet</p>
                      <p className="text-sm">Click "Add Items" to select from your Products & Services</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                        <div className="col-span-5">Description</div>
                        <div className="col-span-2 text-right">Qty</div>
                        <div className="col-span-2 text-right">Unit Price</div>
                        <div className="col-span-2 text-right">Amount</div>
                        <div className="col-span-1"></div>
                      </div>

                      {lineItems.map((item, index) => (
                        <div key={index} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5">
                            <Input
                              value={item.description}
                              onChange={(e) => handleUpdateLineItem(index, 'description', e.target.value)}
                              placeholder="Item description"
                              data-testid={`input-item-description-${index}`}
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e) => handleUpdateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="text-right"
                              data-testid={`input-item-quantity-${index}`}
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="text-right"
                              data-testid={`input-item-price-${index}`}
                            />
                          </div>
                          <div className="col-span-2 text-right font-medium">
                            {formatCurrency(item.quantity * item.unitPrice, form.watch("currency"))}
                          </div>
                          <div className="col-span-1 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveItem(index)}
                              data-testid={`button-remove-item-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Totals */}
                      <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium" data-testid="text-subtotal">
                            {formatCurrency(subtotal, form.watch("currency"))}
                          </span>
                        </div>
                        {taxSettings && taxRate > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Tax ({taxRate}%):
                            </span>
                            <span className="font-medium" data-testid="text-tax">
                              {formatCurrency(taxAmount, form.watch("currency"))}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold border-t pt-2">
                          <span>Total:</span>
                          <span data-testid="text-total">
                            {formatCurrency(total, form.watch("currency"))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Additional Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Add any notes for the client..."
                            rows={3}
                            data-testid="textarea-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="terms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Terms & Conditions</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="Payment terms, cancellation policy, etc..."
                            rows={3}
                            data-testid="textarea-terms"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-between items-center">
                <div>
                  {editingInvoice && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setShowDeleteDialog(true)}
                      data-testid="button-delete"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Invoice
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={saveInvoiceMutation.isPending}
                    data-testid="button-save"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveInvoiceMutation.isPending ? "Saving..." : "Save Invoice"}
                  </Button>
                  <Button 
                    type="button"
                    onClick={() => form.handleSubmit((data) => onSubmit(data, true))()}
                    disabled={saveInvoiceMutation.isPending}
                    data-testid="button-send"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {saveInvoiceMutation.isPending ? "Sending..." : "Send to Contact"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Items Dialog */}
      <Dialog open={showItemsDialog} onOpenChange={setShowItemsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Items from Products & Services</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {invoiceItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No products or services available</p>
                <p className="text-sm">Go to Settings → Products & Services to add items</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {invoiceItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Checkbox
                        checked={selectedItemsForAdding.has(item.id)}
                        onCheckedChange={(checked) => {
                          const newSet = new Set(selectedItemsForAdding);
                          if (checked) {
                            newSet.add(item.id);
                          } else {
                            newSet.delete(item.id);
                          }
                          setSelectedItemsForAdding(newSet);
                        }}
                        data-testid={`checkbox-item-${item.id}`}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-sm text-muted-foreground">{item.description}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency(item.unitPrice, form.watch("currency"))}
                        </div>
                        <div className="text-sm text-muted-foreground">{item.category}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {selectedItemsForAdding.size} item{selectedItemsForAdding.size !== 1 ? 's' : ''} selected
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowItemsDialog(false);
                    setSelectedItemsForAdding(new Set());
                  }}
                  data-testid="button-cancel-add-items"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddItems}
                  disabled={selectedItemsForAdding.size === 0}
                  data-testid="button-confirm-add-items"
                >
                  Add {selectedItemsForAdding.size > 0 ? `(${selectedItemsForAdding.size})` : ''} Items
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteInvoiceMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteInvoiceMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
