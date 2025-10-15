import { FileText, FileCheck, FileX, DollarSign, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DocumentStatusIndicatorsProps {
  projectId: string;
  documentStatuses?: {
    quotes?: Record<string, number>;
    contracts?: Array<{
      status: string;
      clientSignedAt?: string;
      businessSignedAt?: string;
      signatureWorkflow?: string;
    }>;
    invoices?: Record<string, number>;
  };
}

export function DocumentStatusIndicators({ projectId, documentStatuses }: DocumentStatusIndicatorsProps) {
  if (!documentStatuses) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  const quotes = documentStatuses.quotes || {};
  const contracts = documentStatuses.contracts || [];
  const invoices = documentStatuses.invoices || {};

  // Calculate quote status
  const quoteTotal = Object.values(quotes).reduce((sum, count) => sum + count, 0);
  const quoteApproved = quotes.approved || 0;
  const quoteSent = quotes.sent || 0;
  const quoteDraft = quotes.draft || 0;

  // Calculate contract status
  const contractTotal = contracts.length;
  const contractSigned = contracts.filter(c => c.status === 'signed').length;
  const contractSent = contracts.filter(c => c.status === 'sent' || c.status === 'awaiting_counter_signature').length;
  const contractDraft = contracts.filter(c => c.status === 'draft').length;

  // Calculate invoice status
  const invoiceTotal = Object.values(invoices).reduce((sum, count) => sum + count, 0);
  const invoicePaid = invoices.paid || 0;
  const invoiceSent = invoices.sent || 0;
  const invoiceDraft = invoices.draft || 0;
  const invoiceOverdue = invoices.overdue || 0;

  // Helper to determine icon color
  const getQuoteColor = () => {
    if (quoteTotal === 0) return 'text-muted-foreground';
    if (quoteApproved > 0) return 'text-green-600 dark:text-green-500';
    if (quoteSent > 0) return 'text-yellow-600 dark:text-yellow-500';
    return 'text-gray-400 dark:text-gray-600';
  };

  const getContractColor = () => {
    if (contractTotal === 0) return 'text-muted-foreground';
    if (contractSigned > 0) return 'text-green-600 dark:text-green-500';
    if (contractSent > 0) return 'text-yellow-600 dark:text-yellow-500';
    return 'text-gray-400 dark:text-gray-600';
  };

  const getInvoiceColor = () => {
    if (invoiceTotal === 0) return 'text-muted-foreground';
    if (invoiceOverdue > 0) return 'text-red-600 dark:text-red-500';
    if (invoicePaid > 0) return 'text-green-600 dark:text-green-500';
    if (invoiceSent > 0) return 'text-yellow-600 dark:text-yellow-500';
    return 'text-gray-400 dark:text-gray-600';
  };

  const getQuoteTooltip = () => {
    if (quoteTotal === 0) return 'No quotes';
    const parts = [];
    if (quoteApproved > 0) parts.push(`${quoteApproved} approved`);
    if (quoteSent > 0) parts.push(`${quoteSent} sent`);
    if (quoteDraft > 0) parts.push(`${quoteDraft} draft`);
    return `Quotes: ${parts.join(', ')}`;
  };

  const getContractTooltip = () => {
    if (contractTotal === 0) return 'No contracts';
    const parts = [];
    if (contractSigned > 0) parts.push(`${contractSigned} signed`);
    if (contractSent > 0) parts.push(`${contractSent} sent`);
    if (contractDraft > 0) parts.push(`${contractDraft} draft`);
    return `Contracts: ${parts.join(', ')}`;
  };

  const getInvoiceTooltip = () => {
    if (invoiceTotal === 0) return 'No invoices';
    const parts = [];
    if (invoicePaid > 0) parts.push(`${invoicePaid} paid`);
    if (invoiceOverdue > 0) parts.push(`${invoiceOverdue} overdue`);
    if (invoiceSent > 0) parts.push(`${invoiceSent} sent`);
    if (invoiceDraft > 0) parts.push(`${invoiceDraft} draft`);
    return `Invoices: ${parts.join(', ')}`;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-3" data-testid={`document-indicators-${projectId}`}>
        {/* Quote Indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center ${getQuoteColor()}`} data-testid={`quote-indicator-${projectId}`}>
              <FileText className="h-4 w-4" />
              {quoteTotal > 0 && (
                <span className="ml-1 text-xs font-medium">{quoteTotal}</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getQuoteTooltip()}</p>
          </TooltipContent>
        </Tooltip>

        {/* Contract Indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center ${getContractColor()}`} data-testid={`contract-indicator-${projectId}`}>
              <FileCheck className="h-4 w-4" />
              {contractTotal > 0 && (
                <span className="ml-1 text-xs font-medium">{contractTotal}</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getContractTooltip()}</p>
          </TooltipContent>
        </Tooltip>

        {/* Invoice Indicator */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center ${getInvoiceColor()}`} data-testid={`invoice-indicator-${projectId}`}>
              <DollarSign className="h-4 w-4" />
              {invoiceTotal > 0 && (
                <span className="ml-1 text-xs font-medium">{invoiceTotal}</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getInvoiceTooltip()}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
