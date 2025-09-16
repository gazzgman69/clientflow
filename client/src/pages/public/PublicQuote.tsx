import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Package, Plus, Star } from 'lucide-react';

interface QuotePackage {
  id: string;
  name: string;
  description: string | null;
  price: string;
  features: string[] | null;
  isPopular: boolean | null;
  sortOrder: number;
}

interface QuoteAddon {
  id: string;
  name: string;
  description: string | null;
  price: string;
  category: string | null;
  sortOrder: number;
}

interface QuoteItem {
  id: string;
  quoteId: string;
  itemType: string;
  packageId: string | null;
  addonId: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

interface Quote {
  id: string;
  title: string;
  description: string | null;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  vatMode: string;
  total: string;
  validUntil: string | null;
  contractText: string | null;
  status: string;
}

interface QuoteData {
  quote: Quote;
  items: QuoteItem[];
  packages: QuotePackage[];
  addons: QuoteAddon[];
}

interface PublicQuoteProps {
  token: string;
}

export default function PublicQuote({ token }: PublicQuoteProps) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [showSignature, setShowSignature] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signatureEmail, setSignatureEmail] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const { toast } = useToast();

  // Fetch quote data
  const { data: quoteData, isLoading, error } = useQuery<QuoteData>({
    queryKey: ['/api/public/quotes', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/quotes/${token}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Quote not found or expired');
        }
        throw new Error('Failed to load quote');
      }
      return response.json();
    },
  });

  // Submit signature mutation
  const signatureMutation = useMutation({
    mutationFn: async (signatureData: any) => {
      const response = await fetch(`/api/public/quotes/${token}/signature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signatureData),
      });
      if (!response.ok) {
        throw new Error('Failed to submit signature');
      }
      return response.json();
    },
    onSuccess: () => {
      setSigned(true);
      toast({
        title: 'Quote Signed Successfully!',
        description: 'Thank you for accepting our quote. We will be in touch soon.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Signature Failed',
        description: error.message || 'Please try again later.',
        variant: 'destructive',
      });
    },
  });

  // Calculate totals based on selections
  const calculateTotals = () => {
    if (!quoteData) return { subtotal: 0, vatAmount: 0, total: 0 };

    let subtotal = 0;

    // Add selected package price
    if (selectedPackage) {
      const pkg = quoteData.packages.find(p => p.id === selectedPackage);
      if (pkg) {
        subtotal += parseFloat(pkg.price);
      }
    }

    // Add selected addons prices
    selectedAddons.forEach(addonId => {
      const addon = quoteData.addons.find(a => a.id === addonId);
      if (addon) {
        subtotal += parseFloat(addon.price);
      }
    });

    const vatRate = parseFloat(quoteData.quote.vatRate) / 100;
    let vatAmount = 0;
    let total = 0;

    if (quoteData.quote.vatMode === 'inclusive') {
      // VAT is included in the prices
      vatAmount = subtotal * vatRate / (1 + vatRate);
      total = subtotal;
    } else {
      // VAT is added to the prices
      vatAmount = subtotal * vatRate;
      total = subtotal + vatAmount;
    }

    return { subtotal, vatAmount, total };
  };

  const { subtotal, vatAmount, total } = calculateTotals();

  const handleSignQuote = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signatureName.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter your full name to sign the quote.',
        variant: 'destructive',
      });
      return;
    }

    if (!signatureEmail.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address.',
        variant: 'destructive',
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        title: 'Terms Acceptance Required',
        description: 'Please accept the terms and conditions to proceed.',
        variant: 'destructive',
      });
      return;
    }

    signatureMutation.mutate({
      signerName: signatureName,
      signerEmail: signatureEmail,
      ipAddress: 'client', // Could be enhanced to capture real IP
      userAgent: navigator.userAgent,
      metadata: JSON.stringify({
        selectedPackage,
        selectedAddons: Array.from(selectedAddons),
        calculatedTotal: total
      })
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 bg-muted rounded w-48 mb-4 mx-auto"></div>
          <div className="h-4 bg-muted rounded w-64 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error || !quoteData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-semibold mb-2">Quote Not Found</h2>
            <p className="text-muted-foreground">
              {error?.message || "The quote you're looking for doesn't exist or has expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Quote Signed Successfully!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for accepting our quote. We'll be in touch soon to discuss next steps.
            </p>
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
              <p><strong>Quote:</strong> {quoteData.quote.title}</p>
              <p><strong>Total:</strong> £{total.toFixed(2)}</p>
              <p><strong>Signed by:</strong> {signatureName}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Quote Header */}
        <Card className="mb-6" data-testid="quote-header">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{quoteData.quote.title}</CardTitle>
                {quoteData.quote.description && (
                  <p className="text-muted-foreground mt-2">{quoteData.quote.description}</p>
                )}
              </div>
              <div className="text-right">
                <Badge variant="outline" className="mb-2">
                  {quoteData.quote.status.charAt(0).toUpperCase() + quoteData.quote.status.slice(1)}
                </Badge>
                {quoteData.quote.validUntil && (
                  <p className="text-sm text-muted-foreground">
                    Valid until: {new Date(quoteData.quote.validUntil).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Packages Selection */}
          <div className="lg:col-span-2">
            <Card data-testid="packages-section">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Choose Your Package
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Select the package that best fits your needs
                </p>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={selectedPackage || ''}
                  onValueChange={setSelectedPackage}
                  className="space-y-4"
                >
                  {quoteData.packages
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((pkg) => (
                      <div key={pkg.id} className="relative">
                        <div className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          selectedPackage === pkg.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-muted hover:border-primary/50'
                        }`}>
                          {pkg.isPopular && (
                            <div className="absolute -top-2 left-4">
                              <Badge className="bg-primary text-primary-foreground">
                                <Star className="w-3 h-3 mr-1" />
                                Most Popular
                              </Badge>
                            </div>
                          )}
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem 
                              value={pkg.id} 
                              id={pkg.id}
                              data-testid={`package-${pkg.id}`}
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <Label htmlFor={pkg.id} className="font-semibold cursor-pointer">
                                  {pkg.name}
                                </Label>
                                <span className="text-lg font-bold">£{parseFloat(pkg.price).toFixed(2)}</span>
                              </div>
                              {pkg.description && (
                                <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>
                              )}
                              {pkg.features && pkg.features.length > 0 && (
                                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                                  {pkg.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-center gap-2">
                                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                                      {feature}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Add-ons Selection */}
            {quoteData.addons.length > 0 && (
              <Card className="mt-6" data-testid="addons-section">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Optional Add-ons
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Enhance your package with these optional extras
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {quoteData.addons
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((addon) => (
                        <div 
                          key={addon.id} 
                          className={`border rounded-lg p-4 cursor-pointer transition-all ${
                            selectedAddons.has(addon.id) 
                              ? 'border-primary bg-primary/5' 
                              : 'border-muted hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              id={addon.id}
                              checked={selectedAddons.has(addon.id)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedAddons);
                                if (checked) {
                                  newSelected.add(addon.id);
                                } else {
                                  newSelected.delete(addon.id);
                                }
                                setSelectedAddons(newSelected);
                              }}
                              data-testid={`addon-${addon.id}`}
                            />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <Label htmlFor={addon.id} className="font-medium cursor-pointer">
                                  {addon.name}
                                </Label>
                                <span className="font-semibold">+£{parseFloat(addon.price).toFixed(2)}</span>
                              </div>
                              {addon.description && (
                                <p className="text-sm text-muted-foreground mt-1">{addon.description}</p>
                              )}
                              {addon.category && (
                                <Badge variant="secondary" className="mt-2 text-xs">
                                  {addon.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-4" data-testid="order-summary">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedPackage && (
                  <div>
                    <h4 className="font-medium mb-2">Selected Package</h4>
                    {(() => {
                      const pkg = quoteData.packages.find(p => p.id === selectedPackage);
                      return pkg ? (
                        <div className="flex justify-between text-sm">
                          <span>{pkg.name}</span>
                          <span>£{parseFloat(pkg.price).toFixed(2)}</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {selectedAddons.size > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Add-ons</h4>
                    <div className="space-y-1">
                      {Array.from(selectedAddons).map(addonId => {
                        const addon = quoteData.addons.find(a => a.id === addonId);
                        return addon ? (
                          <div key={addon.id} className="flex justify-between text-sm">
                            <span>{addon.name}</span>
                            <span>£{parseFloat(addon.price).toFixed(2)}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>£{subtotal.toFixed(2)}</span>
                  </div>
                  {vatAmount > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>VAT ({parseFloat(quoteData.quote.vatRate)}%)</span>
                      <span>£{vatAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>£{total.toFixed(2)}</span>
                  </div>
                </div>

                {!showSignature && total > 0 && (
                  <Button 
                    onClick={() => setShowSignature(true)} 
                    className="w-full"
                    data-testid="button-accept-quote"
                  >
                    Accept Quote
                  </Button>
                )}

                {showSignature && (
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium">Sign to Accept</h4>
                    <form onSubmit={handleSignQuote} className="space-y-3">
                      <div>
                        <Label htmlFor="signatureName" className="text-sm">Full Name</Label>
                        <Input
                          id="signatureName"
                          value={signatureName}
                          onChange={(e) => setSignatureName(e.target.value)}
                          placeholder="Enter your full name"
                          required
                          data-testid="input-signature-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="signatureEmail" className="text-sm">Email Address</Label>
                        <Input
                          id="signatureEmail"
                          type="email"
                          value={signatureEmail}
                          onChange={(e) => setSignatureEmail(e.target.value)}
                          placeholder="Enter your email"
                          required
                          data-testid="input-signature-email"
                        />
                      </div>
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="acceptTerms"
                          checked={acceptTerms}
                          onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                          data-testid="checkbox-accept-terms"
                        />
                        <Label htmlFor="acceptTerms" className="text-xs text-muted-foreground leading-tight">
                          I accept the terms and conditions and authorize this digital signature
                        </Label>
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full"
                        disabled={signatureMutation.isPending}
                        data-testid="button-submit-signature"
                      >
                        {signatureMutation.isPending ? 'Signing...' : 'Sign Quote'}
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contract Text */}
        {quoteData.quote.contractText && (
          <Card className="mt-6" data-testid="contract-text">
            <CardHeader>
              <CardTitle>Terms & Conditions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-muted-foreground">
                {quoteData.quote.contractText.split('\n').map((paragraph, idx) => (
                  <p key={idx} className="mb-2">{paragraph}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}