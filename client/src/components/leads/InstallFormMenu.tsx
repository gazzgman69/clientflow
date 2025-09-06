import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface InstallFormMenuProps {
  slug: string;
  children: React.ReactNode;
}

export default function InstallFormMenu({ slug, children }: InstallFormMenuProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const baseUrl = window.location.origin;

  const hostedUrl = `${baseUrl}/f/${slug}`;
  
  const embedCode = `<div data-crm-form="${slug}"></div>
<script src="${baseUrl}/embed.js" data-slug="${slug}" async></script>`;

  const popupCode = `<script>
function openLeadForm(slug){
  var w=520,h=700,l=(screen.width-w)/2,t=(screen.height-h)/2;
  window.open('/f/'+slug+'?dialog=1','crmLeadForm','width='+w+',height='+h+',left='+l+',top='+t);
}
</script>
<button onclick="openLeadForm('${slug}')">Open Lead Form</button>`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(label);
      setTimeout(() => setCopiedCode(null), 2000);
      toast({
        title: 'Copied to clipboard',
        description: `${label} code copied successfully`,
      });
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Could not copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="install-form-dialog">
        <DialogHeader>
          <DialogTitle>Install Form</DialogTitle>
          <DialogDescription>
            Choose how you want to add this form to your website
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="hosted" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hosted">Hosted Link</TabsTrigger>
            <TabsTrigger value="embed">Website Embed</TabsTrigger>
            <TabsTrigger value="popup">Dialog/Popup</TabsTrigger>
          </TabsList>

          <TabsContent value="hosted" className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Direct Link</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Share this URL directly or use it as a landing page
              </p>
              <div className="flex gap-2">
                <Textarea
                  value={hostedUrl}
                  readOnly
                  className="font-mono text-sm resize-none"
                  rows={1}
                  data-testid="hosted-url"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(hostedUrl, 'Hosted URL')}
                  data-testid="copy-hosted-url"
                >
                  {copiedCode === 'Hosted URL' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(hostedUrl, '_blank')}
                  data-testid="open-hosted-url"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="embed" className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Embed Code</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Copy and paste this code into your website where you want the form to appear
              </p>
              <div className="space-y-2">
                <Textarea
                  value={embedCode}
                  readOnly
                  className="font-mono text-sm"
                  rows={3}
                  data-testid="embed-code"
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(embedCode, 'Embed Code')}
                  className="w-full"
                  data-testid="copy-embed-code"
                >
                  {copiedCode === 'Embed Code' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Embed Code
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="popup" className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Popup/Dialog Code</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Add this code to create a button that opens the form in a popup window
              </p>
              <div className="space-y-2">
                <Textarea
                  value={popupCode}
                  readOnly
                  className="font-mono text-sm"
                  rows={6}
                  data-testid="popup-code"
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(popupCode, 'Popup Code')}
                  className="w-full"
                  data-testid="copy-popup-code"
                >
                  {copiedCode === 'Popup Code' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Popup Code
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}