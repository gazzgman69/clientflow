import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertLeadSchema } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

// Quick-add form schema — designed for speed (target: under 20 seconds)
const quickAddSchema = insertLeadSchema.extend({
  estimatedValue: z.string().optional(),
  budgetRange: z.string().optional(),
  referralSource: z.string().optional(),
  eventType: z.string().optional(),
  projectDate: z.string().optional(),
  eventLocation: z.string().optional(),
});

// Budget range options — currency symbol comes from tenant settings
const BUDGET_RANGES = [
  { value: 'under_500', label: 'Under 500' },
  { value: '500_1000', label: '500 - 1,000' },
  { value: '1000_2000', label: '1,000 - 2,000' },
  { value: '2000_3000', label: '2,000 - 3,000' },
  { value: '3000_5000', label: '3,000 - 5,000' },
  { value: '5000_plus', label: '5,000+' },
] as const;

const EVENT_TYPES = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'private_party', label: 'Private Party' },
  { value: 'festival', label: 'Festival' },
  { value: 'charity', label: 'Charity Event' },
  { value: 'other', label: 'Other' },
] as const;

const REFERRAL_SOURCES = [
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral / Word of Mouth' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'directory', label: 'Directory (Bark, Hitched etc)' },
  { value: 'google', label: 'Google Search' },
  { value: 'repeat_client', label: 'Repeat Client' },
  { value: 'other', label: 'Other' },
] as const;

interface LeadCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LeadCaptureModal({ isOpen, onClose }: LeadCaptureModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof quickAddSchema>>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      eventType: "",
      projectDate: "",
      eventLocation: "",
      budgetRange: "",
      referralSource: "",
      notes: "",
      status: "new",
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: async (data: z.infer<typeof quickAddSchema>) => {
      const leadData = {
        ...data,
        estimatedValue: data.estimatedValue ? parseFloat(data.estimatedValue) : null,
        leadSource: data.referralSource || 'Manual Entry',
      };
      const response = await apiRequest("POST", "/api/leads", leadData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Lead added", description: "New enquiry added successfully." });
      form.reset();
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add lead. Please try again.", variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof quickAddSchema>) => {
    createLeadMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Add Enquiry</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Core fields — Name + Email (required) */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="First name" data-testid="input-first-name" autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Last name" data-testid="input-last-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} placeholder="email@example.com" data-testid="input-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Event details — date + type (core fields per spec) */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="projectDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} data-testid="input-event-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-event-type">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EVENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Optional fields — Phone, Venue, Budget, Source */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" {...field} value={field.value || ""} placeholder="Phone number" data-testid="input-phone" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eventLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Venue name or location" data-testid="input-venue" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="budgetRange"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget Range</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-budget-range">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BUDGET_RANGES.map((range) => (
                          <SelectItem key={range.value} value={range.value}>£{range.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="referralSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>How Did You Hear?</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-referral-source">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REFERRAL_SOURCES.map((source) => (
                          <SelectItem key={source.value} value={source.value}>{source.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Any extra details..."
                      {...field}
                      value={field.value || ""}
                      data-testid="textarea-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-end space-x-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createLeadMutation.isPending} data-testid="button-add-lead">
                {createLeadMutation.isPending ? "Adding..." : "Add Enquiry"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
