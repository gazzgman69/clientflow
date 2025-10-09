import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface PublicContractProps {
  id: string;
}

type Contract = {
  id: string;
  contractNumber: string;
  title: string;
  displayTitle: string | null;
  bodyHtml: string | null;
  dueDate: string | null;
  status: string;
  signatureWorkflow: string;
  clientSignature: string | null;
  businessSignature: string | null;
  clientSignedAt: string | null;
  businessSignedAt: string | null;
};

type Contact = {
  firstName: string;
  lastName: string;
  fullName: string | null;
};

type Tenant = {
  name: string;
};

export default function PublicContract({ id }: PublicContractProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [clientSignatureName, setClientSignatureName] = useState("");
  
  // Fetch contract data
  const { data, isLoading, error } = useQuery<{ contract: Contract; contact: Contact; tenant: Tenant }>({
    queryKey: ['/api/public/contracts', id],
    queryFn: async () => {
      const response = await fetch(`/api/public/contracts/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Contract not found');
        }
        throw new Error('Failed to load contract');
      }
      return response.json();
    },
  });

  // Client signature mutation
  const clientSignMutation = useMutation({
    mutationFn: async (signature: string) => {
      const response = await fetch(`/api/public/contracts/${id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, signatureType: 'client' }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to sign contract');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/public/contracts', id] });
      setClientSignatureName("");
      toast({
        title: "Success",
        description: "Contract signed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClientSign = () => {
    if (!clientSignatureName.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        variant: "destructive",
      });
      return;
    }
    clientSignMutation.mutate(clientSignatureName);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Contract Not Found</h1>
          <p className="text-gray-600">The contract you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const { contract, contact, tenant } = data;

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500",
    sent: "bg-blue-500",
    awaiting_counter_signature: "bg-yellow-500",
    signed: "bg-green-500",
    cancelled: "bg-red-500",
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Contract {contract.contractNumber}</h1>
            <Badge className={`${statusColors[contract.status]} text-white`}>
              {contract.status.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Contract Card */}
        <Card>
          <CardHeader className="text-center border-b">
            <h2 className="text-2xl font-bold">
              {contract.displayTitle || contract.title}
            </h2>
            {contract.dueDate && (
              <p className="text-sm text-muted-foreground mt-2">
                Due Date: {format(new Date(contract.dueDate), "MMMM d, yyyy")}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-8">
            {/* Contract Body */}
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: contract.bodyHtml || '' }}
            />

            {/* Signature Section */}
            {contract.signatureWorkflow !== 'not_required' && (
              <div className="mt-12 pt-8 border-t">
                <h3 className="text-lg font-semibold mb-4">Agreement Confirmation</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  By signing below, you confirm that you have read, understood, and agreed to the terms of this contract.
                </p>

                <div className="space-y-6">
                  {/* Client Signature */}
                  <div className="pb-4">
                    <label className="block text-sm font-medium text-muted-foreground uppercase mb-2">
                      {contact?.fullName || `${contact?.firstName} ${contact?.lastName}`}
                    </label>
                    {contract.clientSignature ? (
                      <div className="border-b-2 border-gray-300 pb-2">
                        <p className="font-signature text-2xl">{contract.clientSignature}</p>
                        {contract.clientSignedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Signed on {format(new Date(contract.clientSignedAt), "MMMM d, yyyy 'at' h:mm a")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Input
                          placeholder="Type your full name to sign"
                          value={clientSignatureName}
                          onChange={(e) => setClientSignatureName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleClientSign();
                            }
                          }}
                          className="flex-1 font-signature text-lg"
                          data-testid="input-client-signature"
                        />
                        <Button 
                          onClick={handleClientSign}
                          disabled={clientSignMutation.isPending || !clientSignatureName.trim()}
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                          data-testid="button-sign-contract"
                        >
                          {clientSignMutation.isPending ? 'Signing...' : 'Sign Contract'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Business Signature - Only show for counter_sign_after_client */}
                  {contract.signatureWorkflow === 'counter_sign_after_client' && (
                    <div className="pb-4">
                      <label className="block text-sm font-medium text-muted-foreground uppercase mb-2">
                        {tenant?.name || 'Business'}
                      </label>
                      {contract.businessSignature ? (
                        <div className="border-b-2 border-gray-300 pb-2">
                          <p className="font-signature text-2xl">{contract.businessSignature}</p>
                          {contract.businessSignedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Signed on {format(new Date(contract.businessSignedAt), "MMMM d, yyyy 'at' h:mm a")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="border-b-2 border-gray-300 pb-2 h-12 flex items-center">
                          <p className="text-sm text-muted-foreground italic">
                            {contract.clientSignature ? 'Awaiting business signature' : 'Awaiting client signature'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
