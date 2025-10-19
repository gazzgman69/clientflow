import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Plus, Trash2, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, addDays } from "date-fns";
import { formatCurrency } from "@/lib/currency";

interface PaymentScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceTotal: number;
  currency: string;
  projectDate?: Date;
  dueDate?: Date;
}

type ScheduleType = "custom" | "equal";
type DueDateTrigger = "on_receipt" | "after_receipt" | "on_project_date" | "after_project_date" | "before_project_date" | "on_due_date" | "after_due_date" | "before_due_date" | "custom_date";

interface Installment {
  installmentNumber: number;
  amountType: "fixed" | "percentage";
  amount: number;
  dueDateTrigger: DueDateTrigger;
  dueDateOffset: number;
  customDueDate?: Date;
  description: string;
}

export default function PaymentScheduleModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceTotal,
  currency,
  projectDate,
  dueDate
}: PaymentScheduleModalProps) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>("equal");
  const [numberOfInstallments, setNumberOfInstallments] = useState(3);
  const [installmentError, setInstallmentError] = useState<string>("");
  const [customInstallments, setCustomInstallments] = useState<Installment[]>([
    {
      installmentNumber: 1,
      amountType: "percentage",
      amount: 50,
      dueDateTrigger: "on_receipt",
      dueDateOffset: 0,
      description: "Deposit"
    },
    {
      installmentNumber: 2,
      amountType: "percentage",
      amount: 50,
      dueDateTrigger: "on_due_date",
      dueDateOffset: 0,
      description: "Final Payment"
    }
  ]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Validate number of installments
  const validateInstallments = (count: number): boolean => {
    if (!count || count < 1) {
      setInstallmentError("Number of installments must be at least 1");
      return false;
    }
    if (count > 12) {
      setInstallmentError("Number of installments cannot exceed 12");
      return false;
    }
    setInstallmentError("");
    return true;
  };

  // Calculate installments for equal split
  const calculateEqualInstallments = () => {
    if (!validateInstallments(numberOfInstallments)) {
      return [];
    }
    const perInstallment = invoiceTotal / numberOfInstallments;
    return Array.from({ length: numberOfInstallments }, (_, i) => ({
      installmentNumber: i + 1,
      amount: perInstallment,
      description: `Installment ${i + 1} of ${numberOfInstallments}`
    }));
  };

  // Calculate total for custom installments
  const calculateCustomTotal = () => {
    return customInstallments.reduce((sum, inst) => {
      if (inst.amountType === "fixed") {
        return sum + inst.amount;
      } else {
        return sum + (invoiceTotal * (inst.amount / 100));
      }
    }, 0);
  };

  const customTotal = calculateCustomTotal();
  const isCustomTotalValid = Math.abs(customTotal - invoiceTotal) < 0.01;
  const isEqualInstallmentsValid = validateInstallments(numberOfInstallments);
  const equalInstallments = calculateEqualInstallments();

  // Add custom installment
  const addCustomInstallment = () => {
    const nextNumber = customInstallments.length + 1;
    setCustomInstallments([
      ...customInstallments,
      {
        installmentNumber: nextNumber,
        amountType: "percentage",
        amount: 0,
        dueDateTrigger: "on_receipt",
        dueDateOffset: 0,
        description: `Installment ${nextNumber}`
      }
    ]);
  };

  // Remove custom installment
  const removeCustomInstallment = (index: number) => {
    const newInstallments = customInstallments.filter((_, i) => i !== index);
    // Renumber
    const renumbered = newInstallments.map((inst, i) => ({
      ...inst,
      installmentNumber: i + 1
    }));
    setCustomInstallments(renumbered);
  };

  // Update custom installment
  const updateCustomInstallment = (index: number, updates: Partial<Installment>) => {
    const newInstallments = [...customInstallments];
    newInstallments[index] = { ...newInstallments[index], ...updates };
    setCustomInstallments(newInstallments);
  };

  // Save payment schedule mutation
  const saveScheduleMutation = useMutation({
    mutationFn: async () => {
      // Create payment schedule
      const scheduleData = {
        scheduleType,
        totalAmount: invoiceTotal,
        numberOfInstallments: scheduleType === "equal" ? numberOfInstallments : customInstallments.length
      };

      const schedule = await apiRequest("POST", `/api/invoices/${invoiceId}/payment-schedule`, scheduleData);

      // Create installments
      const installmentsToCreate = scheduleType === "equal" 
        ? calculateEqualInstallments().map((inst, i) => ({
            paymentScheduleId: schedule.id,
            installmentNumber: inst.installmentNumber,
            amountType: "fixed" as const,
            amount: inst.amount,
            dueDateTrigger: "after_receipt" as DueDateTrigger,
            dueDateOffset: i * 30, // 30 days apart
            description: inst.description,
            status: "pending" as const
          }))
        : customInstallments.map(inst => ({
            paymentScheduleId: schedule.id,
            installmentNumber: inst.installmentNumber,
            amountType: inst.amountType,
            amount: inst.amount,
            dueDateTrigger: inst.dueDateTrigger,
            dueDateOffset: inst.dueDateOffset,
            customDueDate: inst.customDueDate?.toISOString(),
            description: inst.description,
            status: "pending" as const
          }));

      await apiRequest("POST", `/api/payment-schedules/${schedule.id}/installments`, installmentsToCreate);

      return schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId, "payment-schedule"] });
      
      toast({
        title: "Payment schedule created",
        description: `${scheduleType === "equal" ? "Equal" : "Custom"} payment schedule has been set up`,
      });
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create payment schedule",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (scheduleType === "equal" && !isEqualInstallmentsValid) {
      toast({
        title: "Invalid configuration",
        description: installmentError || "Please enter a valid number of installments",
        variant: "destructive",
      });
      return;
    }

    if (scheduleType === "custom" && !isCustomTotalValid) {
      toast({
        title: "Invalid amounts",
        description: "Custom installments must add up to the invoice total",
        variant: "destructive",
      });
      return;
    }

    saveScheduleMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Configure Payment Schedule
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Schedule Type Selection */}
          <div className="space-y-4">
            <Label>Schedule Type</Label>
            <RadioGroup
              value={scheduleType}
              onValueChange={(value) => setScheduleType(value as ScheduleType)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="equal" id="equal" data-testid="radio-equal" />
                <Label htmlFor="equal" className="font-normal cursor-pointer">
                  <div>
                    <div className="font-medium">Equal Payments</div>
                    <div className="text-sm text-muted-foreground">Split the total into equal installments automatically</div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" data-testid="radio-custom" />
                <Label htmlFor="custom" className="font-normal cursor-pointer">
                  <div>
                    <div className="font-medium">Custom Payments</div>
                    <div className="text-sm text-muted-foreground">Define specific amounts and dates for each installment</div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Equal Payment Configuration */}
          {scheduleType === "equal" && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label htmlFor="numberOfInstallments">Number of Installments *</Label>
                  <Input
                    id="numberOfInstallments"
                    type="number"
                    min="1"
                    max="12"
                    value={numberOfInstallments}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setNumberOfInstallments(value);
                      validateInstallments(value);
                    }}
                    className={cn("mt-2", installmentError && "border-destructive")}
                    data-testid="input-number-installments"
                  />
                  {installmentError && (
                    <div className="flex items-center gap-2 text-sm text-destructive mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <span>{installmentError}</span>
                    </div>
                  )}
                </div>

                {isEqualInstallmentsValid && equalInstallments.length > 0 && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <div className="text-sm font-medium mb-2">Preview:</div>
                    <div className="space-y-2">
                      {equalInstallments.map((inst, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span>{inst.description}</span>
                          <span className="font-medium" data-testid={`text-equal-amount-${i}`}>
                            {formatCurrency(inst.amount, currency)}
                          </span>
                        </div>
                      ))}
                      <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                        <span>Total:</span>
                        <span data-testid="text-equal-total">{formatCurrency(invoiceTotal, currency)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Custom Payment Configuration */}
          {scheduleType === "custom" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Installments</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={addCustomInstallment}
                  data-testid="button-add-installment"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Installment
                </Button>
              </div>

              <div className="space-y-4">
                {customInstallments.map((inst, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="font-medium">Installment {inst.installmentNumber}</div>
                        {customInstallments.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCustomInstallment(index)}
                            data-testid={`button-remove-installment-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Description</Label>
                          <Input
                            value={inst.description}
                            onChange={(e) => updateCustomInstallment(index, { description: e.target.value })}
                            placeholder="e.g., Deposit"
                            className="mt-2"
                            data-testid={`input-description-${index}`}
                          />
                        </div>

                        <div>
                          <Label>Amount Type</Label>
                          <Select
                            value={inst.amountType}
                            onValueChange={(value: "fixed" | "percentage") => 
                              updateCustomInstallment(index, { amountType: value })
                            }
                          >
                            <SelectTrigger className="mt-2" data-testid={`select-amount-type-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Fixed Amount</SelectItem>
                              <SelectItem value="percentage">Percentage</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>
                            {inst.amountType === "fixed" ? "Amount" : "Percentage (%)"}
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step={inst.amountType === "fixed" ? "0.01" : "1"}
                            value={inst.amount}
                            onChange={(e) => updateCustomInstallment(index, { amount: parseFloat(e.target.value) || 0 })}
                            className="mt-2"
                            data-testid={`input-amount-${index}`}
                          />
                          {inst.amountType === "percentage" && (
                            <div className="text-sm text-muted-foreground mt-1">
                              = {formatCurrency(invoiceTotal * (inst.amount / 100), currency)}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label>Due Date Trigger</Label>
                          <Select
                            value={inst.dueDateTrigger}
                            onValueChange={(value: DueDateTrigger) => 
                              updateCustomInstallment(index, { dueDateTrigger: value })
                            }
                          >
                            <SelectTrigger className="mt-2" data-testid={`select-due-trigger-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="on_receipt">On Receipt</SelectItem>
                              <SelectItem value="after_receipt">After Receipt</SelectItem>
                              {projectDate && <SelectItem value="on_project_date">On Project Date</SelectItem>}
                              {projectDate && <SelectItem value="after_project_date">After Project Date</SelectItem>}
                              {projectDate && <SelectItem value="before_project_date">Before Project Date</SelectItem>}
                              {dueDate && <SelectItem value="on_due_date">On Due Date</SelectItem>}
                              {dueDate && <SelectItem value="after_due_date">After Due Date</SelectItem>}
                              {dueDate && <SelectItem value="before_due_date">Before Due Date</SelectItem>}
                              <SelectItem value="custom_date">Custom Date</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {inst.dueDateTrigger !== "on_receipt" && inst.dueDateTrigger !== "on_project_date" && inst.dueDateTrigger !== "on_due_date" && inst.dueDateTrigger !== "custom_date" && (
                          <div>
                            <Label>Days Offset</Label>
                            <Input
                              type="number"
                              min="0"
                              value={inst.dueDateOffset}
                              onChange={(e) => updateCustomInstallment(index, { dueDateOffset: parseInt(e.target.value) || 0 })}
                              className="mt-2"
                              data-testid={`input-offset-${index}`}
                            />
                          </div>
                        )}

                        {inst.dueDateTrigger === "custom_date" && (
                          <div>
                            <Label>Custom Date</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full mt-2 pl-3 text-left font-normal",
                                    !inst.customDueDate && "text-muted-foreground"
                                  )}
                                  data-testid={`button-custom-date-${index}`}
                                >
                                  {inst.customDueDate ? format(inst.customDueDate, "PPP") : <span>Pick a date</span>}
                                  <Calendar className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <CalendarComponent
                                  mode="single"
                                  selected={inst.customDueDate}
                                  onSelect={(date) => updateCustomInstallment(index, { customDueDate: date })}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Custom Total Summary */}
              <Card className={!isCustomTotalValid ? "border-destructive" : ""}>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total from installments:</span>
                      <span className="font-medium" data-testid="text-custom-total">
                        {formatCurrency(customTotal, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Invoice total:</span>
                      <span className="font-medium" data-testid="text-invoice-total">
                        {formatCurrency(invoiceTotal, currency)}
                      </span>
                    </div>
                    {!isCustomTotalValid && (
                      <div className="flex items-center gap-2 text-sm text-destructive pt-2">
                        <AlertCircle className="h-4 w-4" />
                        <span>Installments must add up to invoice total</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={
              saveScheduleMutation.isPending || 
              (scheduleType === "equal" && !isEqualInstallmentsValid) ||
              (scheduleType === "custom" && !isCustomTotalValid)
            }
            data-testid="button-save-schedule"
          >
            {saveScheduleMutation.isPending ? "Creating..." : "Create Payment Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
