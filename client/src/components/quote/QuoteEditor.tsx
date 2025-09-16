import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parse, isPast } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar, CalendarIcon, Package, Plus, Save, Send, Trash2, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Quote, QuotePackage, QuoteAddon, Contact, Client } from "@shared/schema";
import { z } from "zod";

// Enhanced form schema for the quote editor
const quoteEditorSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  eventDate: z.date().optional(),
  venue: z.string().optional(),
  currency: z.string().default("GBP"),
  vatMode: z.enum(["inclusive", "exclusive"]).default("exclusive"),
  validUntil: z.date().refine(date => !isPast(date), "Valid until date cannot be in the past"),
  status: z.enum(["draft", "sent", "approved", "rejected", "expired"]).default("draft"),
});

type QuoteEditorForm = z.infer<typeof quoteEditorSchema>;

interface QuoteEditorProps {
  isOpen: boolean;
  onClose: () => void;
  contactId?: string;
  contactName?: string;
  editingQuote?: Quote | null;
  onContactSelect?: (contactId: string, contactName: string) => void;
}

interface SelectedItems {
  packageId: string | null;
  addonIds: Set<string>;
}

export default function QuoteEditor({ 
  isOpen, 
  onClose, 
  contactId: initialContactId, 
  contactName: initialContactName,
  editingQuote,
  onContactSelect
}: QuoteEditorProps) {
  const [selectedItems, setSelectedItems] = useState<SelectedItems>({
    packageId: null,
    addonIds: new Set()
  });
  const [contactInfo, setContactInfo] = useState({ id: initialContactId || "", name: initialContactName || "" });

  // Update contactInfo when props change
  useEffect(() => {
    setContactInfo({ 
      id: initialContactId || "", 
      name: initialContactName || "" 
    });
  }, [initialContactId, initialContactName]);

  // Method to update contact information (used by ContactPicker)
  const updateContactInfo = (contactId: string, contactName: string) => {
    setContactInfo({ id: contactId, name: contactName });
    form.setValue('contactId', contactId);
    if (onContactSelect) {
      onContactSelect(contactId, contactName);
    }
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<QuoteEditorForm>({
    resolver: zodResolver(quoteEditorSchema),
    defaultValues: {
      contactId: contactInfo.id,
      title: "",
      description: "",
      currency: "GBP",
      vatMode: "exclusive",
      status: "draft",
    },
  });

  // Fetch packages and add-ons with error handling
  const { data: packages, error: packagesError } = useQuery<QuotePackage[]>({
    queryKey: ["/api/admin/packages"],
    retry: 1,
    retryOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: addons, error: addonsError } = useQuery<QuoteAddon[]>({
    queryKey: ["/api/admin/addons"],
    retry: 1,
    retryOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Populate form when editing or when contactInfo changes
  useEffect(() => {
    if (editingQuote) {
      form.reset({
        contactId: editingQuote.contactId || "",
        title: editingQuote.title,
        description: editingQuote.description || "",
        eventDate: editingQuote.eventDate ? new Date(editingQuote.eventDate) : undefined,
        venue: editingQuote.venue || "",
        currency: editingQuote.currency || "GBP",
        vatMode: editingQuote.vatMode as "inclusive" | "exclusive",
        validUntil: editingQuote.validUntil ? new Date(editingQuote.validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: editingQuote.status as any,
      });
      // Update contactInfo from editing quote if available
      if (editingQuote.contactId) {
        setContactInfo(prev => ({ ...prev, id: editingQuote.contactId! }));
      }
    } else {
      // Reset for new quote
      form.reset({
        contactId: contactInfo.id,
        title: "",
        description: "",
        currency: "GBP",
        vatMode: "exclusive",
        status: "draft",
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      });
      setSelectedItems({ packageId: null, addonIds: new Set() });
    }
  }, [editingQuote, contactInfo.id, form]);

  // Calculate live totals
  const calculateTotals = () => {
    let subtotal = 0;
    const vatMode = form.watch("vatMode");

    // Add selected package
    if (selectedItems.packageId) {
      const selectedPackage = packages?.find(p => p.id === selectedItems.packageId);
      if (selectedPackage) {
        subtotal += parseFloat(selectedPackage.basePrice);
      }
    }

    // Add selected add-ons
    selectedItems.addonIds.forEach(addonId => {
      const addon = addons?.find(a => a.id === addonId);
      if (addon) {
        subtotal += parseFloat(addon.price);
      }
    });

    // Calculate VAT
    let vatAmount = 0;
    let total = 0;

    if (vatMode === "inclusive") {
      // VAT is already included in the subtotal
      total = subtotal;
      vatAmount = total - (total / 1.20); // Assuming 20% VAT
    } else {
      // VAT is added to subtotal
      vatAmount = subtotal * 0.20; // 20% VAT
      total = subtotal + vatAmount;
    }

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      vatAmount: parseFloat(vatAmount.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  };

  const totals = calculateTotals();

  // Package selection handler
  const handlePackageSelect = (packageId: string) => {
    setSelectedItems(prev => ({
      ...prev,
      packageId: packageId === prev.packageId ? null : packageId
    }));
  };

  // Add-on selection handler
  const handleAddonToggle = (addonId: string) => {
    setSelectedItems(prev => {
      const newAddonIds = new Set(prev.addonIds);
      if (newAddonIds.has(addonId)) {
        newAddonIds.delete(addonId);
      } else {
        newAddonIds.add(addonId);
      }
      return {
        ...prev,
        addonIds: newAddonIds
      };
    });
  };

  // Create/Update quote mutation
  const saveQuoteMutation = useMutation({
    mutationFn: async (data: { formData: QuoteEditorForm; isDraft: boolean }) => {
      const { formData, isDraft } = data;
      
      const quoteData = {
        ...formData,
        eventDate: formData.eventDate?.toISOString(),
        validUntil: formData.validUntil?.toISOString(),
        subtotal: totals.subtotal,
        taxAmount: totals.vatAmount,
        total: totals.total,
        status: isDraft ? "draft" : "sent",
        quoteNumber: editingQuote?.quoteNumber || `Q-${Date.now()}`,
        createdBy: "test-user", // TODO: Get from auth context
        selectedPackageId: selectedItems.packageId,
        selectedAddonIds: Array.from(selectedItems.addonIds),
      };

      const url = editingQuote ? `/api/quotes/${editingQuote.id}` : "/api/quotes";
      const method = editingQuote ? "PUT" : "POST";
      
      const response = await apiRequest(method, url, quoteData);
      return response.json();
    },
    onSuccess: (data, variables) => {
      const { formData } = variables;
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", formData.contactId, "quotes"] });
      
      toast({
        title: "Success",
        description: `Quote ${variables.isDraft ? 'saved as draft' : 'sent'} successfully!`,
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save quote. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Form submission handlers
  const handleSaveDraft = (data: QuoteEditorForm) => {
    saveQuoteMutation.mutate({ formData: data, isDraft: true });
  };

  const handleSendQuote = (data: QuoteEditorForm) => {
    // Validate valid until is not in the past when sending
    if (isPast(data.validUntil)) {
      toast({
        title: "Invalid Date",
        description: "Cannot send quote with valid until date in the past.",
        variant: "destructive",
      });
      return;
    }
    
    saveQuoteMutation.mutate({ formData: data, isDraft: false });
  };

  // Format date for display (dd/mm/yyyy)
  const formatDateDisplay = (date: Date | undefined) => {
    if (!date) return "";
    return format(date, "dd/MM/yyyy");
  };

  // Parse date from dd/mm/yyyy string
  const parseDateInput = (dateString: string) => {
    try {
      return parse(dateString, "dd/MM/yyyy", new Date());
    } catch {
      return null;
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {editingQuote ? "Edit Quote" : "Create New Quote"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          <Form {...form}>
            <form className="space-y-6">
              {/* Contact Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Contact Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium" data-testid="selected-contact-name">
                      {contactInfo.name || "No contact selected"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Contact ID: {contactInfo.id || "None"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Basic Quote Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Quote Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-quote-status">
                                <SelectValue placeholder="Select status..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="sent">Sent</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="rejected">Rejected</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
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
                      name="eventDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Event Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  data-testid="button-event-date"
                                >
                                  {field.value ? (
                                    formatDateDisplay(field.value)
                                  ) : (
                                    <span>Pick event date</span>
                                  )}
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
                      name="venue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Venue</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Event venue..." 
                              {...field} 
                              value={field.value || ""}
                              data-testid="input-quote-venue"
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
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-quote-currency">
                                <SelectValue placeholder="Select currency..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="GBP">GBP (£)</SelectItem>
                              <SelectItem value="USD">USD ($)</SelectItem>
                              <SelectItem value="EUR">EUR (€)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="vatMode"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>VAT Mode</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-row space-x-6"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="exclusive" id="vat-exclusive" />
                                <Label htmlFor="vat-exclusive">Exclusive (VAT added)</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="inclusive" id="vat-inclusive" />
                                <Label htmlFor="vat-inclusive">Inclusive (VAT included)</Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="validUntil"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Valid Until *</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  data-testid="button-valid-until"
                                >
                                  {field.value ? (
                                    formatDateDisplay(field.value)
                                  ) : (
                                    <span>Pick valid until date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => isPast(date)}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Package Selection */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Package Selection (Choose One)</CardTitle>
                </CardHeader>
                <CardContent>
                  {packagesError ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Packages feature not yet configured</p>
                      <p className="text-xs">Quote totals will be calculated from manual entries</p>
                    </div>
                  ) : packages && packages.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {packages.map((pkg) => (
                        <div
                          key={pkg.id}
                          className={cn(
                            "border rounded-lg p-4 cursor-pointer transition-all",
                            selectedItems.packageId === pkg.id
                              ? "border-primary bg-primary/5"
                              : "border-muted hover:border-muted-foreground"
                          )}
                          onClick={() => handlePackageSelect(pkg.id)}
                          data-testid={`package-option-${pkg.id}`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">{pkg.name}</h4>
                              <Badge variant={selectedItems.packageId === pkg.id ? "default" : "secondary"}>
                                £{parseFloat(pkg.basePrice).toFixed(2)}
                              </Badge>
                            </div>
                            {pkg.description && (
                              <p className="text-sm text-muted-foreground">{pkg.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No packages available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add-ons Selection */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Add-ons Selection (Choose Any)</CardTitle>
                </CardHeader>
                <CardContent>
                  {addonsError ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Add-ons feature not yet configured</p>
                      <p className="text-xs">Quote totals will be calculated from manual entries</p>
                    </div>
                  ) : addons && addons.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {addons.map((addon) => (
                        <div
                          key={addon.id}
                          className="border rounded-lg p-4"
                        >
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id={`addon-${addon.id}`}
                              checked={selectedItems.addonIds.has(addon.id)}
                              onCheckedChange={() => handleAddonToggle(addon.id)}
                              data-testid={`addon-checkbox-${addon.id}`}
                            />
                            <div className="space-y-1 flex-1">
                              <Label 
                                htmlFor={`addon-${addon.id}`}
                                className="font-medium cursor-pointer"
                              >
                                {addon.name}
                              </Label>
                              {addon.description && (
                                <p className="text-sm text-muted-foreground">{addon.description}</p>
                              )}
                              <div className="flex items-center justify-between">
                                <Badge variant="outline">
                                  £{parseFloat(addon.price).toFixed(2)}
                                </Badge>
                                {addon.category && (
                                  <span className="text-xs text-muted-foreground">
                                    {addon.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Plus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No add-ons available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Live Totals */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Quote Totals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span data-testid="quote-subtotal">£{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>VAT (20%):</span>
                      <span data-testid="quote-vat">£{totals.vatAmount.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-medium">
                        <span>Total:</span>
                        <span data-testid="quote-total">£{totals.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </form>
          </Form>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-cancel-quote-editor"
          >
            Cancel
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={form.handleSubmit(handleSaveDraft)}
              disabled={saveQuoteMutation.isPending || !contactInfo.id}
              data-testid="button-save-draft"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveQuoteMutation.isPending ? "Saving..." : "Save Draft"}
            </Button>
            
            <Button
              onClick={form.handleSubmit(handleSendQuote)}
              disabled={saveQuoteMutation.isPending || !contactInfo.id || !selectedItems.packageId}
              data-testid="button-send-quote"
            >
              <Send className="h-4 w-4 mr-2" />
              {saveQuoteMutation.isPending ? "Sending..." : "Send Quote"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}