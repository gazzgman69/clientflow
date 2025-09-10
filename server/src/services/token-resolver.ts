import { IStorage } from '../../storage';
import { storage } from '../../storage';
import type { Contact, Project, Quote, Contract, Invoice } from '@shared/schema';

export interface TokenResolutionContext {
  contactId?: string;
  projectId?: string;
}

export interface TokenFormatOptions {
  format?: string;
}

export interface TokenResolver {
  resolve(context: TokenResolutionContext): Promise<string>;
}

export interface TokenResolutionResult {
  rendered: string;
  unresolved: string[];
}

export class TokenResolverService {
  private storage: IStorage;
  private tokenRegistry: Map<string, TokenResolver>;

  constructor(storageInstance: IStorage) {
    this.storage = storageInstance;
    this.tokenRegistry = new Map();
    this.initializeTokenRegistry();
  }

  private initializeTokenRegistry() {
    // Contact tokens
    this.tokenRegistry.set('FirstName', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.firstName || '';
      }
    });

    this.tokenRegistry.set('LastName', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.lastName || '';
      }
    });

    this.tokenRegistry.set('FullName', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.fullName || `${contact?.firstName || ''} ${contact?.lastName || ''}`.trim();
      }
    });

    this.tokenRegistry.set('Email', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.email || '';
      }
    });

    this.tokenRegistry.set('Phone', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.phone || '';
      }
    });

    this.tokenRegistry.set('Company', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.company || '';
      }
    });

    // Address tokens
    this.tokenRegistry.set('Address1', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.address || '';
      }
    });

    this.tokenRegistry.set('Address2', {
      resolve: async (context) => {
        return ''; // Most addresses don't have a second line in our schema
      }
    });

    this.tokenRegistry.set('City', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.city || '';
      }
    });

    this.tokenRegistry.set('State', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.state || '';
      }
    });

    this.tokenRegistry.set('Province', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.state || ''; // Use state field for province
      }
    });

    this.tokenRegistry.set('Zip', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.zipCode || '';
      }
    });

    this.tokenRegistry.set('PostalCode', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.zipCode || ''; // Use zipCode for postal code
      }
    });

    this.tokenRegistry.set('Country', {
      resolve: async (context) => {
        const contact = await this.getContact(context.contactId);
        return contact?.country || '';
      }
    });

    // Project tokens
    this.tokenRegistry.set('ProjectName', {
      resolve: async (context) => {
        const project = await this.getProject(context.projectId);
        return project?.name || '';
      }
    });

    this.tokenRegistry.set('ProjectType', {
      resolve: async (context) => {
        const project = await this.getProject(context.projectId);
        return project?.status || ''; // Using status as type for now
      }
    });

    this.tokenRegistry.set('ProjectDate', {
      resolve: async (context) => {
        const project = await this.getProject(context.projectId);
        if (!project?.startDate) return '';
        return project.startDate.toISOString();
      }
    });

    this.tokenRegistry.set('ProjectLocation', {
      resolve: async (context) => {
        const project = await this.getProject(context.projectId);
        if (!project?.venueId) return '';
        
        // Get venue information if available
        try {
          const venue = await this.storage.getVenue?.(project.venueId);
          return venue ? `${venue.name || ''} ${venue.address || ''}`.trim() : '';
        } catch {
          return '';
        }
      }
    });

    this.tokenRegistry.set('ProjectAddress', {
      resolve: async (context) => {
        const project = await this.getProject(context.projectId);
        if (!project?.venueId) return '';
        
        try {
          const venue = await this.storage.getVenue?.(project.venueId);
          return venue?.address || '';
        } catch {
          return '';
        }
      }
    });

    this.tokenRegistry.set('ProjectNotes', {
      resolve: async (context) => {
        const project = await this.getProject(context.projectId);
        return project?.description || '';
      }
    });

    // Link tokens - these will return URLs based on the app's routing
    this.tokenRegistry.set('InvoiceLink', {
      resolve: async (context) => {
        if (!context.projectId) return '';
        const invoices = await this.getProjectInvoices(context.projectId);
        const latestInvoice = invoices[0]; // Get the most recent
        return latestInvoice ? `/invoices/${latestInvoice.id}` : '';
      }
    });

    this.tokenRegistry.set('QuoteLink', {
      resolve: async (context) => {
        if (!context.contactId) return '';
        const quotes = await this.getContactQuotes(context.contactId);
        const latestQuote = quotes[0]; // Get the most recent
        return latestQuote ? `/quotes/${latestQuote.id}` : '';
      }
    });

    this.tokenRegistry.set('ContractLink', {
      resolve: async (context) => {
        if (!context.contactId) return '';
        const contracts = await this.getContactContracts(context.contactId);
        const latestContract = contracts[0]; // Get the most recent
        return latestContract ? `/contracts/${latestContract.id}` : '';
      }
    });

    this.tokenRegistry.set('PaymentSchedule', {
      resolve: async (context) => {
        // This would need to be implemented based on your payment system
        return '';
      }
    });

    this.tokenRegistry.set('BalanceDue', {
      resolve: async (context) => {
        if (!context.projectId) return '0.00';
        const invoices = await this.getProjectInvoices(context.projectId);
        const totalDue = invoices.reduce((sum, invoice) => {
          // If invoice is not paid, add full amount to balance due
          const amount = parseFloat(invoice.total?.toString() || '0');
          return invoice.paidAt ? sum : sum + amount;
        }, 0);
        return totalDue.toString();
      }
    });

    // Business/Self tokens - these would typically come from settings
    this.tokenRegistry.set('BusinessName', {
      resolve: async () => {
        return process.env.BUSINESS_NAME || 'Your Business';
      }
    });

    this.tokenRegistry.set('MyFirstName', {
      resolve: async () => {
        return process.env.OWNER_FIRST_NAME || 'Business';
      }
    });

    this.tokenRegistry.set('MyLastName', {
      resolve: async () => {
        return process.env.OWNER_LAST_NAME || 'Owner';
      }
    });

    this.tokenRegistry.set('MyFullName', {
      resolve: async () => {
        const first = process.env.OWNER_FIRST_NAME || 'Business';
        const last = process.env.OWNER_LAST_NAME || 'Owner';
        return `${first} ${last}`.trim();
      }
    });

    this.tokenRegistry.set('MyEmail', {
      resolve: async () => {
        return process.env.BUSINESS_EMAIL || 'contact@yourbusiness.com';
      }
    });

    this.tokenRegistry.set('MyPhone', {
      resolve: async () => {
        return process.env.BUSINESS_PHONE || '';
      }
    });

    this.tokenRegistry.set('CurrentDate', {
      resolve: async () => {
        return new Date().toISOString();
      }
    });

    this.tokenRegistry.set('ClientPortalLink', {
      resolve: async (context) => {
        return context.contactId ? `/client-portal/${context.contactId}` : '/client-portal';
      }
    });
  }

  /**
   * Resolve all tokens in a template string
   */
  async resolveTemplate(template: string, context: TokenResolutionContext): Promise<TokenResolutionResult> {
    const unresolved: string[] = [];
    
    // Find all tokens in format [TokenName] or [TokenName|format]
    const tokenRegex = /\[([^\]|]+)(?:\|([^\]]+))?\]/g;
    let match;
    const tokens: { full: string; name: string; format?: string }[] = [];
    
    while ((match = tokenRegex.exec(template)) !== null) {
      tokens.push({
        full: match[0],
        name: match[1],
        format: match[2]
      });
    }

    let rendered = template;

    // Process each unique token
    for (const token of tokens) {
      try {
        const resolver = this.tokenRegistry.get(token.name);
        if (!resolver) {
          unresolved.push(token.name);
          // Replace with empty string for missing tokens
          rendered = rendered.replace(new RegExp(`\\[${this.escapeRegex(token.name)}(?:\\|[^\\]]+)?\\]`, 'g'), '');
          continue;
        }

        const rawValue = await resolver.resolve(context);
        const formattedValue = this.formatValue(rawValue, token.format);
        const safeValue = this.escapeHtml(formattedValue);

        // Replace all instances of this token
        rendered = rendered.replace(
          new RegExp(`\\[${this.escapeRegex(token.name)}(?:\\|[^\\]]+)?\\]`, 'g'),
          safeValue
        );
      } catch (error) {
        console.error(`Error resolving token ${token.name}:`, error);
        unresolved.push(token.name);
        // Replace with empty string for errored tokens
        rendered = rendered.replace(new RegExp(`\\[${this.escapeRegex(token.name)}(?:\\|[^\\]]+)?\\]`, 'g'), '');
      }
    }

    return { rendered, unresolved };
  }

  /**
   * Get list of all available tokens with descriptions
   */
  getAvailableTokens(): { [category: string]: { [token: string]: string } } {
    return {
      contact: {
        '[FirstName]': "Contact's first name",
        '[LastName]': "Contact's last name",
        '[FullName]': "Contact's full name",
        '[Email]': "Contact's email address",
        '[Phone]': "Contact's phone number",
        '[Company]': "Contact's company name",
        '[Address1]': "Contact's address line 1",
        '[Address2]': "Contact's address line 2",
        '[City]': "Contact's city",
        '[State]': "Contact's state",
        '[Province]': "Contact's province",
        '[Zip]': "Contact's ZIP code",
        '[PostalCode]': "Contact's postal code",
        '[Country]': "Contact's country"
      },
      project: {
        '[ProjectName]': "Project name",
        '[ProjectType]': "Project type/status",
        '[ProjectDate]': "Project start date",
        '[ProjectLocation]': "Project venue location",
        '[ProjectAddress]': "Project venue address", 
        '[ProjectNotes]': "Project description/notes",
        '[InvoiceLink]': "Link to latest project invoice",
        '[QuoteLink]': "Link to latest quote",
        '[ContractLink]': "Link to latest contract",
        '[PaymentSchedule]': "Payment schedule details",
        '[BalanceDue]': "Outstanding balance amount"
      },
      business: {
        '[BusinessName]': "Your business name",
        '[MyFirstName]': "Your first name", 
        '[MyLastName]': "Your last name",
        '[MyFullName]': "Your full name",
        '[MyEmail]': "Your business email",
        '[MyPhone]': "Your business phone",
        '[CurrentDate]': "Current date",
        '[ClientPortalLink]': "Link to client portal"
      }
    };
  }

  private formatValue(value: string, format?: string): string {
    if (!format) return value;

    // Date formatting
    if (format.includes('dd/MM/yyyy') || format.includes('MM/dd/yyyy') || format.includes('yyyy-MM-dd')) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        if (format === 'dd/MM/yyyy') {
          return date.toLocaleDateString('en-GB'); // dd/MM/yyyy format
        }
        if (format === 'MM/dd/yyyy') {
          return date.toLocaleDateString('en-US'); // MM/dd/yyyy format
        }
        if (format === 'yyyy-MM-dd') {
          return date.toISOString().split('T')[0]; // yyyy-MM-dd format
        }
      }
    }

    // Currency formatting
    if (format === 'currency') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(num);
      }
    }

    return value;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Helper methods to get data
  private async getContact(contactId?: string): Promise<Contact | undefined> {
    if (!contactId) return undefined;
    return await this.storage.getContact(contactId);
  }

  private async getProject(projectId?: string): Promise<Project | undefined> {
    if (!projectId) return undefined;
    return await this.storage.getProject(projectId);
  }

  private async getContactQuotes(contactId: string): Promise<Quote[]> {
    try {
      return await this.storage.getQuotesByContact(contactId);
    } catch {
      return [];
    }
  }

  private async getContactContracts(contactId: string): Promise<Contract[]> {
    try {
      return await this.storage.getContractsByClient(contactId);
    } catch {
      return [];
    }
  }

  private async getProjectInvoices(projectId: string): Promise<Invoice[]> {
    try {
      // This would need to be implemented - get invoices by project
      const allInvoices = await this.storage.getInvoices();
      return allInvoices.filter(inv => inv.projectId === projectId);
    } catch {
      return [];
    }
  }
}

export const tokenResolverService = new TokenResolverService(storage);