import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, RefreshCw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface RecurringInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
}

type FrequencyUnit = "day" | "week" | "month" | "year";

export default function RecurringInvoiceModal({
  isOpen,
  onClose,
  invoiceId
}: RecurringInvoiceModalProps) {
  const [frequency, setFrequency] = useState<number>(1);
  const [frequencyUnit, setFrequencyUnit] = useState<FrequencyUnit>("month");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [hasEndDate, setHasEndDate] = useState(false);
  const [maxOccurrences, setMaxOccurrences] = useState<number | undefined>();
  const [hasMaxOccurrences, setHasMaxOccurrences] = useState(false);
  const [autoSend, setAutoSend] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Save recurring settings mutation
  const saveRecurringMutation = useMutation({
    mutationFn: async () => {
      const settingsData = {
        frequency,
        frequencyUnit,
        startDate: startDate.toISOString(),
        endDate: hasEndDate && endDate ? endDate.toISOString() : undefined,
        maxOccurrences: hasMaxOccurrences ? maxOccurrences : undefined,
        autoSend,
        isActive: true,
        nextInvoiceDate: startDate.toISOString()
      };

      return await apiRequest("POST", `/api/invoices/${invoiceId}/recurring-settings`, settingsData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId, "recurring-settings"] });
      
      toast({
        title: "Recurring invoice configured",
        description: "This invoice will now be automatically generated on the specified schedule",
      });
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to configure recurring invoice",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (hasMaxOccurrences && (!maxOccurrences || maxOccurrences < 1)) {
      toast({
        title: "Invalid configuration",
        description: "Maximum occurrences must be at least 1",
        variant: "destructive",
      });
      return;
    }

    if (hasEndDate && endDate && endDate <= startDate) {
      toast({
        title: "Invalid dates",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    saveRecurringMutation.mutate();
  };

  // Generate frequency description
  const getFrequencyDescription = () => {
    const unitText = frequency === 1 
      ? frequencyUnit 
      : `${frequency} ${frequencyUnit}s`;
    
    return `Every ${unitText}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Configure Recurring Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Frequency Configuration */}
          <div className="space-y-4">
            <Label>Frequency</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={frequency}
                  onChange={(e) => setFrequency(parseInt(e.target.value) || 1)}
                  placeholder="1"
                  data-testid="input-frequency"
                />
              </div>
              <div>
                <Select value={frequencyUnit} onValueChange={(value: FrequencyUnit) => setFrequencyUnit(value)}>
                  <SelectTrigger data-testid="select-frequency-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day(s)</SelectItem>
                    <SelectItem value="week">Week(s)</SelectItem>
                    <SelectItem value="month">Month(s)</SelectItem>
                    <SelectItem value="year">Year(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {getFrequencyDescription()}
            </div>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Start Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full pl-3 text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                  data-testid="button-start-date"
                >
                  {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  <Calendar className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <div className="text-sm text-muted-foreground">
              First invoice will be generated on this date
            </div>
          </div>

          {/* End Configuration */}
          <div className="space-y-4">
            <Label>End Condition (Optional)</Label>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={hasEndDate}
                  onCheckedChange={(checked) => {
                    setHasEndDate(checked);
                    if (checked) setHasMaxOccurrences(false);
                  }}
                  data-testid="switch-end-date"
                />
                <Label className="font-normal cursor-pointer" htmlFor="end-date-switch">
                  End on specific date
                </Label>
              </div>
            </div>

            {hasEndDate && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full pl-3 text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                    data-testid="button-end-date"
                  >
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                    <Calendar className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => date <= startDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  checked={hasMaxOccurrences}
                  onCheckedChange={(checked) => {
                    setHasMaxOccurrences(checked);
                    if (checked) setHasEndDate(false);
                  }}
                  data-testid="switch-max-occurrences"
                />
                <Label className="font-normal cursor-pointer" htmlFor="max-occurrences-switch">
                  End after number of invoices
                </Label>
              </div>
            </div>

            {hasMaxOccurrences && (
              <div>
                <Input
                  type="number"
                  min="1"
                  value={maxOccurrences || ""}
                  onChange={(e) => setMaxOccurrences(parseInt(e.target.value) || undefined)}
                  placeholder="Number of invoices"
                  data-testid="input-max-occurrences"
                />
                <div className="text-sm text-muted-foreground mt-1">
                  Recurring will stop after {maxOccurrences || 0} invoice{(maxOccurrences || 0) !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {!hasEndDate && !hasMaxOccurrences && (
              <div className="text-sm text-muted-foreground">
                Recurring will continue indefinitely until manually stopped
              </div>
            )}
          </div>

          {/* Auto Send */}
          <div className="flex items-center justify-between border rounded-lg p-4">
            <div className="space-y-0.5">
              <Label className="font-medium">Automatically Send</Label>
              <div className="text-sm text-muted-foreground">
                Send invoices to the contact automatically when generated
              </div>
            </div>
            <Switch
              checked={autoSend}
              onCheckedChange={setAutoSend}
              data-testid="switch-auto-send"
            />
          </div>

          {/* Summary */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <div className="font-medium mb-2">Summary:</div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>• Frequency: {getFrequencyDescription()}</div>
              <div>• First invoice: {format(startDate, "PPP")}</div>
              {hasEndDate && endDate && <div>• Last invoice: {format(endDate, "PPP")}</div>}
              {hasMaxOccurrences && maxOccurrences && <div>• Total invoices: {maxOccurrences}</div>}
              {!hasEndDate && !hasMaxOccurrences && <div>• Duration: Indefinite</div>}
              <div>• Auto-send: {autoSend ? "Yes" : "No"}</div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saveRecurringMutation.isPending}
            data-testid="button-save-recurring"
          >
            {saveRecurringMutation.isPending ? "Saving..." : "Enable Recurring"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
