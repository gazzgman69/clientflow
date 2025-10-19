import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, Loader2, Upload, X, DollarSign, Tag, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import Header from '@/components/layout/header';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/rich-text-editor';
import { TokenDropdown } from '@/components/ui/token-dropdown';
import { Separator } from '@/components/ui/separator';
import { z } from 'zod';
import { useCurrency } from '@/hooks/useCurrency';

interface InvoiceItem {
  id: string;
  tenantId: string;
  internalName: string;
  displayName: string;
  description: string | null;
  price: string;
  isTaxable: boolean;
  incomeCategoryId: string | null;
  workflowId: string | null;
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface IncomeCategory {
  id: string;
  tenantId: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TaxSettings {
  id: string;
  tenantId: string;
  taxName: string;
  taxRate: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const invoiceItemFormSchema = z.object({
  internalName: z.string().min(1, 'Internal name is required'),
  displayName: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  price: z.string().min(1, 'Unit price is required').refine((val) => !isNaN(parseFloat(val)), 'Must be a valid number'),
  isTaxable: z.boolean().default(true),
  incomeCategoryId: z.string().optional(),
  workflowId: z.string().optional(),
  photoUrl: z.string().optional(),
  isActive: z.boolean().default(true),
});

type InvoiceItemFormData = z.infer<typeof invoiceItemFormSchema>;

const incomeCategoryFormSchema = z.object({
  name: z.string().min(1, 'Category name is required'),
});

type IncomeCategoryFormData = z.infer<typeof incomeCategoryFormSchema>;

const taxSettingsFormSchema = z.object({
  taxName: z.string().min(1, 'Tax name is required'),
  taxRate: z.string().min(1, 'Tax rate is required').refine((val) => !isNaN(parseFloat(val)), 'Must be a valid number'),
  isEnabled: z.boolean(),
});

type TaxSettingsFormData = z.infer<typeof taxSettingsFormSchema>;

export default function ProductsServicesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<IncomeCategory | null>(null);
  const descriptionEditorRef = useRef<RichTextEditorRef>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { format: formatCurrency, currencySymbol } = useCurrency();

  // Fetch invoice items (products & services)
  const { data: items = [], isLoading: itemsLoading } = useQuery<InvoiceItem[]>({
    queryKey: ['/api/invoice-items'],
  });

  // Fetch income categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<IncomeCategory[]>({
    queryKey: ['/api/income-categories'],
  });

  // Fetch tax settings
  const { data: taxSettings, isLoading: taxLoading } = useQuery<TaxSettings>({
    queryKey: ['/api/tax-settings'],
  });

  // Helper to get default category ID (Sales)
  const getDefaultCategoryId = () => {
    const salesCategory = categories.find(cat => cat.name === 'Sales');
    return salesCategory?.id || '';
  };

  // Invoice item form
  const itemForm = useForm<InvoiceItemFormData>({
    resolver: zodResolver(invoiceItemFormSchema),
    defaultValues: {
      internalName: '',
      displayName: '',
      description: '',
      price: '',
      isTaxable: true,
      incomeCategoryId: '',
      workflowId: '',
      photoUrl: '',
      isActive: true,
    },
  });

  // Income category form
  const categoryForm = useForm<IncomeCategoryFormData>({
    resolver: zodResolver(incomeCategoryFormSchema),
    defaultValues: {
      name: '',
    },
  });

  // Tax settings form
  const taxForm = useForm<TaxSettingsFormData>({
    resolver: zodResolver(taxSettingsFormSchema),
    defaultValues: {
      taxName: taxSettings?.taxName || 'VAT',
      taxRate: taxSettings?.taxRate || '20.00',
      isEnabled: taxSettings?.isEnabled ?? true,
    },
  });

  // Update tax form when data loads
  if (taxSettings && !taxLoading) {
    taxForm.reset({
      taxName: taxSettings.taxName,
      taxRate: taxSettings.taxRate,
      isEnabled: taxSettings.isEnabled,
    });
  }

  // Create/Update invoice item mutation
  const saveItemMutation = useMutation({
    mutationFn: async (data: InvoiceItemFormData) => {
      if (editingItem) {
        return apiRequest('PATCH', `/api/invoice-items/${editingItem.id}`, data);
      }
      return apiRequest('POST', '/api/invoice-items', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoice-items'] });
      setShowItemDialog(false);
      setEditingItem(null);
      itemForm.reset({
        internalName: '',
        displayName: '',
        description: '',
        price: '',
        isTaxable: true,
        incomeCategoryId: getDefaultCategoryId(),
        workflowId: '',
        photoUrl: '',
        isActive: true,
      });
      toast({
        title: editingItem ? 'Item updated' : 'Item created',
        description: editingItem ? 'The item has been updated successfully.' : 'The item has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete invoice item mutation
  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/invoice-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoice-items'] });
      toast({
        title: 'Item deleted',
        description: 'The item has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Create income category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: IncomeCategoryFormData) => {
      if (editingCategory) {
        return apiRequest('PATCH', `/api/income-categories/${editingCategory.id}`, data);
      }
      return apiRequest('POST', '/api/income-categories', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/income-categories'] });
      setShowCategoryDialog(false);
      setEditingCategory(null);
      categoryForm.reset();
      toast({
        title: editingCategory ? 'Category updated' : 'Category created',
        description: editingCategory ? 'The category has been updated successfully.' : 'The category has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete income category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/income-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/income-categories'] });
      toast({
        title: 'Category deleted',
        description: 'The category has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update tax settings mutation
  const updateTaxMutation = useMutation({
    mutationFn: async (data: TaxSettingsFormData) => {
      if (taxSettings) {
        return apiRequest('PATCH', '/api/tax-settings', data);
      }
      return apiRequest('POST', '/api/tax-settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tax-settings'] });
      toast({
        title: 'Tax settings updated',
        description: 'The tax settings have been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEditItem = (item: InvoiceItem) => {
    setEditingItem(item);
    itemForm.reset({
      internalName: item.internalName,
      displayName: item.displayName,
      description: item.description || '',
      price: item.price,
      isTaxable: item.isTaxable,
      incomeCategoryId: item.incomeCategoryId || '',
      workflowId: item.workflowId || '',
      photoUrl: item.photoUrl || '',
      isActive: item.isActive,
    });
    setShowItemDialog(true);
  };

  const handleEditCategory = (category: IncomeCategory) => {
    setEditingCategory(category);
    categoryForm.reset({
      name: category.name,
    });
    setShowCategoryDialog(true);
  };

  const handleDeleteItem = (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      deleteItemMutation.mutate(id);
    }
  };

  const handleDeleteCategory = (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const onItemSubmit = (data: InvoiceItemFormData) => {
    const description = descriptionEditorRef.current?.getHTML() || '';
    saveItemMutation.mutate({ ...data, description });
  };

  const onCategorySubmit = (data: IncomeCategoryFormData) => {
    createCategoryMutation.mutate(data);
  };

  const onTaxSubmit = (data: TaxSettingsFormData) => {
    updateTaxMutation.mutate(data);
  };

  // Filter items based on search query
  const filteredItems = items.filter(item => 
    item.internalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-background">
      <Header title="Products & Services" />
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Products & Services Section */}
        <Card data-testid="card-products-services">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Products & Services</CardTitle>
                <CardDescription>Manage your products and services for invoicing</CardDescription>
              </div>
              <Button onClick={() => {
                setEditingItem(null);
                itemForm.reset({
                  internalName: '',
                  displayName: '',
                  description: '',
                  price: '',
                  isTaxable: true,
                  incomeCategoryId: getDefaultCategoryId(),
                  workflowId: '',
                  photoUrl: '',
                  isActive: true,
                });
                setShowItemDialog(true);
              }} data-testid="button-add-item">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products and services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>

              {itemsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-items">
                  {searchQuery ? 'No items found matching your search.' : 'No items yet. Create your first product or service.'}
                </div>
              ) : (
                <div className="border rounded-lg">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Internal Name</th>
                        <th className="text-left p-3 font-medium">Display Name</th>
                        <th className="text-left p-3 font-medium">Unit Price</th>
                        <th className="text-left p-3 font-medium">Category</th>
                        <th className="text-left p-3 font-medium">Taxable</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-right p-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map((item) => {
                        const category = categories.find(c => c.id === item.incomeCategoryId);
                        return (
                          <tr key={item.id} className="border-t" data-testid={`row-item-${item.id}`}>
                            <td className="p-3" data-testid={`text-internal-name-${item.id}`}>{item.internalName}</td>
                            <td className="p-3" data-testid={`text-display-name-${item.id}`}>{item.displayName}</td>
                            <td className="p-3" data-testid={`text-price-${item.id}`}>{formatCurrency(item.price)}</td>
                            <td className="p-3" data-testid={`text-category-${item.id}`}>{category?.name || '-'}</td>
                            <td className="p-3" data-testid={`text-taxable-${item.id}`}>{item.isTaxable ? 'Yes' : 'No'}</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs ${item.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'}`} data-testid={`status-item-${item.id}`}>
                                {item.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="p-3 text-right space-x-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEditItem(item)} data-testid={`button-edit-${item.id}`}>
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)} data-testid={`button-delete-${item.id}`}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Income Categories Section */}
        <Card data-testid="card-income-categories">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Income Categories</CardTitle>
                <CardDescription>Manage categories for organizing your income</CardDescription>
              </div>
              <Button onClick={() => {
                setEditingCategory(null);
                categoryForm.reset();
                setShowCategoryDialog(true);
              }} data-testid="button-add-category">
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {categoriesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {categories.map((category) => (
                  <div key={category.id} className="border rounded-lg p-3 flex items-center justify-between" data-testid={`card-category-${category.id}`}>
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium" data-testid={`text-category-name-${category.id}`}>{category.name}</span>
                      {category.isSystem && (
                        <span className="text-xs text-muted-foreground">(System)</span>
                      )}
                    </div>
                    {!category.isSystem && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEditCategory(category)} data-testid={`button-edit-category-${category.id}`}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.id)} data-testid={`button-delete-category-${category.id}`}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tax Settings Section */}
        <Card data-testid="card-tax-settings">
          <CardHeader>
            <CardTitle>Tax Settings</CardTitle>
            <CardDescription>Configure tax settings for your invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {taxLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Form {...taxForm}>
                <form onSubmit={taxForm.handleSubmit(onTaxSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={taxForm.control}
                      name="taxName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., VAT, GST, Sales Tax" data-testid="input-tax-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={taxForm.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Rate (%)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" placeholder="e.g., 20.00" data-testid="input-tax-rate" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={taxForm.control}
                    name="isEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Tax</FormLabel>
                          <FormDescription>
                            Apply tax to taxable items in invoices
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-tax-enabled"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={updateTaxMutation.isPending} data-testid="button-save-tax">
                    {updateTaxMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Settings2 className="h-4 w-4 mr-2" />
                        Save Tax Settings
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-item">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          <Form {...itemForm}>
            <form onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                  name="internalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="For your records" data-testid="input-internal-name" />
                      </FormControl>
                      <FormDescription>Name used internally for your records</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Shown to clients" data-testid="input-display-name" />
                      </FormControl>
                      <FormDescription>Name shown to clients on invoices</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={itemForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Rich text with tokens support</span>
                          <TokenDropdown
                            onInsertToken={(token) => {
                              descriptionEditorRef.current?.insertText(token);
                            }}
                          />
                        </div>
                        <RichTextEditor
                          ref={descriptionEditorRef}
                          content={field.value || ''}
                          onChange={(html) => field.onChange(html)}
                          placeholder="Add a detailed description..."
                          data-testid="editor-description"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={itemForm.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Price *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm font-medium text-muted-foreground">
                            {currencySymbol}
                          </span>
                          <Input {...field} type="number" step="0.01" className="pl-9" placeholder="0.00" data-testid="input-unit-price" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={itemForm.control}
                  name="incomeCategoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Income Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-income-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id} data-testid={`option-category-${category.id}`}>
                              {category.name}
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
                control={itemForm.control}
                name="workflowId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workflow (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-workflow">
                          <SelectValue placeholder="Select workflow (coming soon)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="placeholder">No workflows available</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Trigger automation when this item is used</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={itemForm.control}
                name="photoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo URL</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input {...field} placeholder="https://example.com/photo.jpg" data-testid="input-photo-url" />
                        <div className="text-sm text-muted-foreground">
                          <Upload className="h-4 w-4 inline mr-1" />
                          Photo upload functionality (coming soon)
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center gap-4">
                <FormField
                  control={itemForm.control}
                  name="isTaxable"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-taxable"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Taxable</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowItemDialog(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={saveItemMutation.isPending} data-testid="button-save">
                  {saveItemMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingItem ? 'Update Item' : 'Create Item'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Category Dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent data-testid="dialog-category">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
          </DialogHeader>
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
              <FormField
                control={categoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Consulting, Products" data-testid="input-category-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCategoryDialog(false)} data-testid="button-cancel-category">
                  Cancel
                </Button>
                <Button type="submit" disabled={createCategoryMutation.isPending} data-testid="button-save-category">
                  {createCategoryMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingCategory ? 'Update Category' : 'Create Category'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
