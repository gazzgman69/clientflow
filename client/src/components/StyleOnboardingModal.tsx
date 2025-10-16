import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface StyleOnboardingModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function StyleOnboardingModal({ open, onClose, onComplete }: StyleOnboardingModalProps) {
  const [samples, setSamples] = useState(['', '', '']);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const saveSamplesMutation = useMutation({
    mutationFn: async (sampleTexts: string[]) => {
      const validSamples = sampleTexts.filter(s => s.trim());
      if (validSamples.length === 0) {
        throw new Error('Please add at least one email sample');
      }

      await apiRequest('POST', '/api/ai/style-samples', {
        samples: validSamples
      });

      // Mark onboarding as complete
      await apiRequest('POST', '/api/ai/style-onboarding-complete', {});
    },
    onSuccess: () => {
      toast({
        title: "✨ Style samples saved!",
        description: "AI will now match your writing style when composing emails",
      });
      onComplete();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save style samples",
        variant: "destructive",
      });
    },
  });

  const skipOnboarding = async () => {
    try {
      await apiRequest('POST', '/api/ai/style-onboarding-complete', {});
      onComplete();
      onClose();
    } catch (error) {
      console.error('Error skipping onboarding:', error);
    }
  };

  const handleSampleChange = (index: number, value: string) => {
    const newSamples = [...samples];
    newSamples[index] = value;
    setSamples(newSamples);
  };

  const addSampleField = () => {
    if (samples.length < 5) {
      setSamples([...samples, '']);
    }
  };

  const removeSampleField = (index: number) => {
    if (samples.length > 1) {
      setSamples(samples.filter((_, i) => i !== index));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Personalize Your AI Assistant
          </DialogTitle>
          <DialogDescription>
            Help AI match your writing style by pasting 2-3 emails you've written before.
            This is optional but makes drafts feel more authentic to you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {samples.map((sample, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Email Sample {index + 1} {index === 0 && <span className="text-muted-foreground">(required)</span>}
                </label>
                {samples.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSampleField(index)}
                    data-testid={`button-remove-sample-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Textarea
                value={sample}
                onChange={(e) => handleSampleChange(index, e.target.value)}
                placeholder="Paste an email you've written..."
                className="min-h-[120px] font-mono text-sm"
                data-testid={`textarea-style-sample-${index}`}
              />
            </div>
          ))}

          {samples.length < 5 && (
            <Button
              variant="outline"
              size="sm"
              onClick={addSampleField}
              data-testid="button-add-sample"
            >
              + Add Another Sample
            </Button>
          )}
        </div>

        <div className="flex justify-between gap-2 mt-6">
          <Button
            variant="ghost"
            onClick={skipOnboarding}
            data-testid="button-skip-onboarding"
          >
            Skip for now
          </Button>
          <Button
            onClick={() => saveSamplesMutation.mutate(samples)}
            disabled={saveSamplesMutation.isPending || !samples[0]?.trim()}
            data-testid="button-save-samples"
          >
            {saveSamplesMutation.isPending ? "Saving..." : "Save & Continue"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2">
          You can always update your style samples later in settings
        </p>
      </DialogContent>
    </Dialog>
  );
}
