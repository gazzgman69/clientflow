import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, File, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContractSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Contract, Client, Project, Quote } from "@shared/schema";
import { z } from "zod";

const contractFormSchema = insertContractSchema.extend({
  amount: z.string().min(1, "Amount is required"),
});

export default function Contracts() {
  const [showContractModal, setShowContractModal] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: quotes } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const form = useForm<z.infer<typeof contractFormSchema>>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      title: "",
      description: "",
      terms: "",
      amount: "",
      status: "draft",
      clientId: "",
      createdBy: "", // This would be set to current user
    },
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: z.infer<typeof contractFormSchema>) => {
      const contractData = {
        ...data,
        amount: parseFloat(data.amount),
        createdBy: "default-user", // This would be set to current user
      };
      const response = await apiRequest("POST", "/api/contracts", contractData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Success",
        description: "Contract created successfully!",
      });
      form.reset();
      setShowContractModal(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create contract. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof contractFormSchema>) => {
    createContractMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'signed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients?.find(c => c.id === clientId);
    return client ? `${client.firstName} ${client.lastName}` : 'Unknown Client';
  };

  const handleAddContract = () => {
    setEditingContract(null);
    form.reset();
    setShowContractModal(true);
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
              <Button onClick={handleAddContract} data-testid="button-add-contract">
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
                <Button onClick={handleAddContract} data-testid="button-add-first-contract">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Contract
                </Button>
              </div>
            ) : (
              <Table data-testid="contracts-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id} data-testid={`contract-row-${contract.id}`}>
                      <TableCell className="font-medium" data-testid={`contract-number-${contract.id}`}>
                        {contract.contractNumber}
                      </TableCell>
                      <TableCell data-testid={`contract-title-${contract.id}`}>
                        {contract.title}
                      </TableCell>
                      <TableCell data-testid={`contract-client-${contract.id}`}>
                        {getClientName(contract.clientId)}
                      </TableCell>
                      <TableCell data-testid={`contract-amount-${contract.id}`}>
                        ${parseFloat(contract.amount).toLocaleString()}
                      </TableCell>
                      <TableCell data-testid={`contract-status-${contract.id}`}>
                        <Badge className={getStatusColor(contract.status)}>
                          {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`contract-created-${contract.id}`}>
                        {formatDistanceToNow(new Date(contract.createdAt!), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" data-testid={`send-contract-${contract.id}`}>
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`edit-contract-${contract.id}`}>
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

      {/* Add/Edit Contract Modal */}
      <Dialog open={showContractModal} onOpenChange={setShowContractModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContract ? 'Edit Contract' : 'Create New Contract'}</DialogTitle>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Title *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-contract-title" />
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
                    <FormLabel>Client *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-contract-client">
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
                        placeholder="Contract description..." 
                        {...field} 
                        value={field.value || ""}
                        data-testid="textarea-contract-description"
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
                        rows={4} 
                        placeholder="Contract terms and conditions..." 
                        {...field} 
                        value={field.value || ""}
                        data-testid="textarea-contract-terms"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Amount *</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        step="0.01"
                        {...field} 
                        data-testid="input-contract-amount" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setShowContractModal(false)}
                  data-testid="button-cancel-contract"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createContractMutation.isPending}
                  data-testid="button-save-contract"
                >
                  {createContractMutation.isPending ? "Creating..." : "Create Contract"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
