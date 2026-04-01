import { useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, FileText, Building, CalendarPlus } from "lucide-react";
import LeadCaptureModal from "./lead-capture-modal";

interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickActionModal({ isOpen, onClose }: QuickActionModalProps) {
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [, setLocation] = useLocation();

  const handleAddLead = () => {
    onClose();
    setShowLeadCapture(true);
  };

  const handleCreateQuote = () => {
    onClose();
    setLocation("/quotes");
  };

  const handleAddClient = () => {
    onClose();
    setLocation("/contacts");
  };

  const handleScheduleAppointment = () => {
    onClose();
    setLocation("/calendar");
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Add</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start h-auto p-3"
              onClick={handleAddLead}
              data-testid="quick-add-lead"
            >
              <UserPlus className="h-5 w-5 text-primary mr-3" />
              <span className="text-sm font-medium">Add New Lead</span>
            </Button>
            
            <Button
              variant="ghost"
              className="w-full justify-start h-auto p-3"
              onClick={handleCreateQuote}
              data-testid="quick-create-quote"
            >
              <FileText className="h-5 w-5 text-accent mr-3" />
              <span className="text-sm font-medium">Create Quote</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-auto p-3"
              onClick={handleAddClient}
              data-testid="quick-add-client"
            >
              <Building className="h-5 w-5 text-green-600 mr-3" />
              <span className="text-sm font-medium">Add Client</span>
            </Button>

            <Button
              variant="ghost"
              className="w-full justify-start h-auto p-3"
              onClick={handleScheduleAppointment}
              data-testid="quick-schedule-appointment"
            >
              <CalendarPlus className="h-5 w-5 text-blue-600 mr-3" />
              <span className="text-sm font-medium">Schedule Appointment</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LeadCaptureModal 
        isOpen={showLeadCapture} 
        onClose={() => setShowLeadCapture(false)} 
      />
    </>
  );
}
