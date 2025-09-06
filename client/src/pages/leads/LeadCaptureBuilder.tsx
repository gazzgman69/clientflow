import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Settings, Eye, Copy, Trash2, FileText } from "lucide-react";

export default function LeadCaptureBuilder() {
  return (
    <>
      <Header 
        title="Lead Capture Forms" 
        subtitle="Create and manage lead capture forms for your website"
      />
      
      <main className="flex-1 overflow-auto p-6">
        <div className="grid gap-6">
          {/* Form Builder Header */}
          <Card data-testid="form-builder-header">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Lead Capture Forms</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Design custom forms to capture leads from your website and landing pages
                  </p>
                </div>
                <Button data-testid="button-create-form">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Form
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Existing Forms */}
          <div className="grid gap-4">
            <h3 className="text-lg font-medium">Your Forms</h3>
            
            {/* Sample Forms */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card data-testid="form-card-contact">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">Contact Form</h4>
                      <p className="text-sm text-muted-foreground">Basic contact information</p>
                    </div>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="text-muted-foreground">Fields: Name, Email, Phone, Message</p>
                    <p className="text-muted-foreground">Submissions: 12 this month</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" data-testid="button-preview-contact">
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-edit-contact">
                      <Settings className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-copy-contact">
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="form-card-quote">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">Quote Request</h4>
                      <p className="text-sm text-muted-foreground">Service quote requests</p>
                    </div>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="text-muted-foreground">Fields: Service, Budget, Timeline, Details</p>
                    <p className="text-muted-foreground">Submissions: 8 this month</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" data-testid="button-preview-quote">
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-edit-quote">
                      <Settings className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-copy-quote">
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="form-card-newsletter">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">Newsletter Signup</h4>
                      <p className="text-sm text-muted-foreground">Email list subscription</p>
                    </div>
                    <Badge variant="outline">Draft</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="text-muted-foreground">Fields: Email, Preferences</p>
                    <p className="text-muted-foreground">Submissions: 0 this month</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" data-testid="button-preview-newsletter">
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-edit-newsletter">
                      <Settings className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-delete-newsletter">
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Quick Actions */}
          <Card data-testid="quick-actions-card">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2" data-testid="button-embed-code">
                  <FileText className="h-6 w-6" />
                  <span className="text-sm font-medium">Get Embed Code</span>
                  <span className="text-xs text-muted-foreground text-center">Copy HTML code for your website</span>
                </Button>
                
                <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2" data-testid="button-form-analytics">
                  <Settings className="h-6 w-6" />
                  <span className="text-sm font-medium">Form Analytics</span>
                  <span className="text-xs text-muted-foreground text-center">View submission reports and stats</span>
                </Button>
                
                <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2" data-testid="button-integrations">
                  <Copy className="h-6 w-6" />
                  <span className="text-sm font-medium">Integrations</span>
                  <span className="text-xs text-muted-foreground text-center">Connect with email marketing tools</span>
                </Button>
                
                <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2" data-testid="button-templates">
                  <Plus className="h-6 w-6" />
                  <span className="text-sm font-medium">Form Templates</span>
                  <span className="text-xs text-muted-foreground text-center">Browse pre-built form templates</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}