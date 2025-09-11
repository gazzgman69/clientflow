import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Save, 
  ExternalLink, 
  Shield, 
  Info, 
  CheckCircle,
  AlertTriangle,
  Users 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUserPrefs } from "@/hooks/useUserPrefs";

export default function PortalSettingsComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  // Get portal enabled setting from user preferences
  const { prefs, setPreference, isSettingPreference } = useUserPrefs(['portalEnabled']);
  
  // Parse portal enabled setting (default to true)
  const portalEnabled = prefs.portalEnabled !== undefined ? prefs.portalEnabled === 'true' : true;

  const handlePortalEnabledChange = async (enabled: boolean) => {
    try {
      setPreference({ key: 'portalEnabled', value: enabled.toString() });
      
      toast({
        title: enabled ? "Client Portal Enabled" : "Client Portal Disabled",
        description: enabled 
          ? "Clients can now access their project portal." 
          : "Client portal access has been disabled for all projects.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update portal settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    
    toast({
      title: "Settings Saved",
      description: "Client portal settings have been updated successfully.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Global Portal Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-base font-medium">Enable Client Portal</Label>
            <p className="text-sm text-muted-foreground">
              Allow clients to access their project portal and documents
            </p>
          </div>
          <Switch 
            checked={portalEnabled}
            onCheckedChange={handlePortalEnabledChange}
            disabled={isSettingPreference}
            data-testid="switch-portal-enabled"
          />
        </div>

        {/* Status indicator */}
        <div className="flex items-center space-x-2">
          {portalEnabled ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Portal Active
              </Badge>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                Portal Disabled
              </Badge>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Portal Information */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Portal Overview</Label>
        
        <Alert data-testid="portal-info-alert">
          <Info className="h-4 w-4" />
          <AlertDescription>
            {portalEnabled ? (
              <>
                The client portal is currently <strong>enabled</strong> for your organization. 
                Clients can access their project information, documents, and submit forms through 
                secure portal links.
              </>
            ) : (
              <>
                The client portal is currently <strong>disabled</strong> for your organization. 
                All portal access has been blocked and clients will see a friendly disabled message.
              </>
            )}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <ExternalLink className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">Portal Access</p>
                <p className="text-sm text-muted-foreground">
                  {portalEnabled ? "Clients can access portal" : "Portal access blocked"}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Shield className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Security</p>
                <p className="text-sm text-muted-foreground">
                  Magic link authentication
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium">Project Control</p>
                <p className="text-sm text-muted-foreground">
                  Per-project portal overrides available
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Portal Features */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Portal Features</Label>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Document Access</p>
              <p className="text-sm text-muted-foreground">Clients can view project documents and files</p>
            </div>
            <Badge variant="outline">Always Available</Badge>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Form Submissions</p>
              <p className="text-sm text-muted-foreground">Clients can submit project-related forms</p>
            </div>
            <Badge variant="outline">Always Available</Badge>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Payment Processing</p>
              <p className="text-sm text-muted-foreground">Secure payment collection through portal</p>
            </div>
            <Badge variant="outline">Always Available</Badge>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <Button 
          onClick={handleSaveSettings}
          disabled={isLoading}
          data-testid="button-save-portal-settings"
        >
          <Save className="h-4 w-4 mr-2" />
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}