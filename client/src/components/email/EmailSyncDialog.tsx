import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail } from "lucide-react";

interface EmailProvider {
  id: string;
  providerKey: string;
  displayName: string;
  authType: string;
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
}

interface EmailSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (data: {
    providerKey: string;
    email: string;
    password?: string;
    imapHost?: string;
    imapPort?: number;
    imapSecure?: boolean;
  }) => void;
  onOAuthConnect: (providerKey: string) => void;
}

export function EmailSyncDialog({ open, onOpenChange, onConnect, onOAuthConnect }: EmailSyncDialogProps) {
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapSecure, setImapSecure] = useState(true);

  // Fetch email providers
  const { data: providers = [] } = useQuery<EmailProvider[]>({
    queryKey: ['/api/email-providers'],
  });

  const provider = providers.find(p => p.providerKey === selectedProvider);

  const handleConnect = () => {
    if (!selectedProvider || !email) return;

    if (provider?.authType === 'oauth') {
      // OAuth flow
      onOAuthConnect(selectedProvider);
    } else {
      // IMAP/SMTP or Custom flow
      onConnect({
        providerKey: selectedProvider,
        email,
        password,
        imapHost: provider?.authType === 'custom' ? imapHost : provider?.imapHost,
        imapPort: provider?.authType === 'custom' ? parseInt(imapPort) : provider?.imapPort,
        imapSecure: provider?.authType === 'custom' ? imapSecure : provider?.imapSecure,
      });
    }

    // Reset form
    setSelectedProvider("");
    setEmail("");
    setPassword("");
    setImapHost("");
    setImapPort("993");
    setImapSecure(true);
    onOpenChange(false);
  };

  const isOAuth = provider?.authType === 'oauth';
  const isCustom = provider?.authType === 'custom';
  const showPassword = provider && !isOAuth;
  const showIMAPConfig = isCustom;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-muted-foreground" />
            <DialogTitle className="text-2xl">Email Sync</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email Provider Dropdown */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="provider" className="text-right font-semibold">
              Email Provider
            </Label>
            <div className="col-span-3">
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger id="provider" data-testid="select-email-provider">
                  <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.providerKey}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Login Field (always shown when provider selected) */}
          {provider && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right font-semibold">
                Login
              </Label>
              <div className="col-span-3">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  data-testid="input-email-login"
                />
              </div>
            </div>
          )}

          {/* Password Field (for IMAP providers) */}
          {showPassword && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right font-semibold">
                Password
              </Label>
              <div className="col-span-3">
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  data-testid="input-email-password"
                />
              </div>
            </div>
          )}

          {/* IMAP Server (for Custom provider) */}
          {showIMAPConfig && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="imap-server" className="text-right font-semibold">
                  IMAP Server
                </Label>
                <div className="col-span-3">
                  <Input
                    id="imap-server"
                    value={imapHost}
                    onChange={(e) => setImapHost(e.target.value)}
                    placeholder="imap.example.com"
                    data-testid="input-imap-server"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="imap-port" className="text-right font-semibold">
                  Port
                </Label>
                <div className="col-span-3">
                  <Input
                    id="imap-port"
                    value={imapPort}
                    onChange={(e) => setImapPort(e.target.value)}
                    placeholder="993"
                    className="w-32"
                    data-testid="input-imap-port"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right font-semibold">
                  SSL
                </Label>
                <div className="col-span-3">
                  <Checkbox
                    checked={imapSecure}
                    onCheckedChange={(checked) => setImapSecure(checked as boolean)}
                    data-testid="checkbox-imap-ssl"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-32"
            data-testid="button-cancel-sync"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={!selectedProvider || !email || (showPassword && !password)}
            className="w-32 bg-green-600 hover:bg-green-700"
            data-testid="button-connect-sync"
          >
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
