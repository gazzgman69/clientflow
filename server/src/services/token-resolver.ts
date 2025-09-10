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
  private entityCache = new Map<string, any>(); // Entity-level cache for current request

  constructor(storageInstance: IStorage) {
    this.storage = storageInstance;
    this.tokenRegistry = new Map();
    this.initializeTokenRegistry();
  }

  /**
   * Get base URL for absolute links
   */
  private getBaseUrl(): string {
    // Prefer APP_BASE_URL if configured
    if (process.env.APP_BASE_URL) {
      return process.env.APP_BASE_URL;
    }
    
    // Use Replit environment if both REPL_SLUG and REPL_OWNER exist
    if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
      return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    }
    
    // Fallback to localhost
    return 'http://localhost:5000';
  }

  /**
   * Clear entity cache (call this at the start of each template resolution)
   */
  private clearEntityCache() {
    this.entityCache.clear();
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
        // Return user-friendly formatted date instead of ISO string
        return project.startDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
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

    // Link tokens - these will return absolute URLs for use in emails
    this.tokenRegistry.set('InvoiceLink', {
      resolve: async (context) => {
        if (!context.projectId) return '';
        const invoices = await this.getProjectInvoices(context.projectId);
        const latestInvoice = invoices[0]; // Get the most recent
        return latestInvoice ? `${this.getBaseUrl()}/invoices/${latestInvoice.id}` : '';
      }
    });

    this.tokenRegistry.set('QuoteLink', {
      resolve: async (context) => {
        if (!context.contactId) return '';
        const quotes = await this.getContactQuotes(context.contactId);
        const latestQuote = quotes[0]; // Get the most recent
        return latestQuote ? `${this.getBaseUrl()}/quotes/${latestQuote.id}` : '';
      }
    });

    this.tokenRegistry.set('ContractLink', {
      resolve: async (context) => {
        if (!context.contactId) return '';
        const contracts = await this.getContactContracts(context.contactId);
        const latestContract = contracts[0]; // Get the most recent
        return latestContract ? `${this.getBaseUrl()}/contracts/${latestContract.id}` : '';
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
        const baseUrl = this.getBaseUrl();
        return context.contactId ? `${baseUrl}/client-portal/${context.contactId}` : `${baseUrl}/client-portal`;
      }
    });
  }

  /**
   * Resolve all tokens in a template string (supports both [Token] and {{token}} formats)
   */
  async resolveTemplate(template: string, context: TokenResolutionContext): Promise<TokenResolutionResult> {
    // Clear entity cache for each new template resolution
    this.clearEntityCache();
    
    const unresolved: string[] = [];
    const resolvedCache = new Map<string, string>(); // Cache for resolved values
    
    // Find all tokens in format [TokenName] or [TokenName|format]
    const newTokenRegex = /\[([^\]|]+)(?:\|([^\]]+))?\]/g;
    // Find all legacy tokens in format {{token.name}}
    const legacyTokenRegex = /\{\{([^}]+)\}\}/g;
    
    let match;
    const tokens: { full: string; name: string; format?: string; isLegacy: boolean }[] = [];
    
    // Parse new format tokens [Token]
    while ((match = newTokenRegex.exec(template)) !== null) {
      tokens.push({
        full: match[0],
        name: match[1],
        format: match[2],
        isLegacy: false
      });
    }
    
    // Reset regex
    legacyTokenRegex.lastIndex = 0;
    
    // Parse legacy format tokens {{token}}
    while ((match = legacyTokenRegex.exec(template)) !== null) {
      const legacyToken = match[1];
      // Map legacy token names to new token names
      const mappedToken = this.mapLegacyToken(legacyToken);
      if (mappedToken) {
        tokens.push({
          full: match[0],
          name: mappedToken,
          format: undefined,
          isLegacy: true
        });
      } else {
        // Unknown legacy token
        unresolved.push(legacyToken);
      }
    }

    let rendered = template;

    // Process each unique token (deduplicated by name+format)
    const processedTokens = new Set<string>();
    
    for (const token of tokens) {
      const cacheKey = `${token.name}:${token.format || ''}`;
      
      // Skip if already processed this token+format combination
      if (processedTokens.has(cacheKey)) {
        continue;
      }
      processedTokens.add(cacheKey);
      
      try {
        let resolvedValue: string;
        
        // Check cache first
        if (resolvedCache.has(cacheKey)) {
          resolvedValue = resolvedCache.get(cacheKey)!;
        } else {
          // Resolve the token
          const resolver = this.tokenRegistry.get(token.name);
          if (!resolver) {
            unresolved.push(token.name);
            resolvedValue = '';
          } else {
            const rawValue = await resolver.resolve(context);
            const formattedValue = this.formatValue(rawValue, token.format);
            resolvedValue = this.escapeHtml(formattedValue);
            
            // Cache the resolved value
            resolvedCache.set(cacheKey, resolvedValue);
          }
        }

        // Replace all instances of this token in both formats
        if (!token.isLegacy) {
          // Replace [Token] format
          rendered = rendered.replace(
            new RegExp(`\\[${this.escapeRegex(token.name)}(?:\\|[^\\]]+)?\\]`, 'g'),
            resolvedValue
          );
        } else {
          // Replace {{token}} format - find original legacy token name
          const originalLegacyToken = this.findOriginalLegacyToken(token.name);
          if (originalLegacyToken) {
            rendered = rendered.replace(
              new RegExp(`\\{\\{${this.escapeRegex(originalLegacyToken)}\\}\\}`, 'g'),
              resolvedValue
            );
          }
        }
      } catch (error) {
        console.error(`Error resolving token ${token.name}:`, error);
        unresolved.push(token.name);
        // Replace with empty string for errored tokens
        if (!token.isLegacy) {
          rendered = rendered.replace(new RegExp(`\\[${this.escapeRegex(token.name)}(?:\\|[^\\]]+)?\\]`, 'g'), '');
        }
      }
    }

    return { rendered, unresolved };
  }

  /**
   * Map legacy token names to new token names
   */
  private mapLegacyToken(legacyToken: string): string | null {
    const mapping: Record<string, string> = {
      'contact.firstName': 'FirstName',
      'contact.lastName': 'LastName',
      'contact.email': 'Email',
      'project.title': 'ProjectName',
      'project.date': 'ProjectDate',
      'project.id': 'ProjectName', // Fallback to project name
      'lead.service': 'ProjectType',
      'lead.message': 'ProjectNotes'
    };
    
    return mapping[legacyToken] || null;
  }

  /**
   * Find the original legacy token name for a mapped token
   */
  private findOriginalLegacyToken(newTokenName: string): string | null {
    const reverseMapping: Record<string, string> = {
      'FirstName': 'contact.firstName',
      'LastName': 'contact.lastName',
      'Email': 'contact.email',
      'ProjectName': 'project.title',
      'ProjectDate': 'project.date',
      'ProjectType': 'lead.service',
      'ProjectNotes': 'lead.message'
    };
    
    return reverseMapping[newTokenName] || null;
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

  // Helper methods to get data (with entity-level caching)
  private async getContact(contactId?: string): Promise<Contact | undefined> {
    if (!contactId) return undefined;
    
    const cacheKey = `contact:${contactId}`;
    if (this.entityCache.has(cacheKey)) {
      return this.entityCache.get(cacheKey);
    }
    
    const contact = await this.storage.getContact(contactId);
    this.entityCache.set(cacheKey, contact);
    return contact;
  }

  private async getProject(projectId?: string): Promise<Project | undefined> {
    if (!projectId) return undefined;
    
    const cacheKey = `project:${projectId}`;
    if (this.entityCache.has(cacheKey)) {
      return this.entityCache.get(cacheKey);
    }
    
    const project = await this.storage.getProject(projectId);
    this.entityCache.set(cacheKey, project);
    return project;
  }

  private async getContactQuotes(contactId: string): Promise<Quote[]> {
    try {
      const cacheKey = `quotes:contact:${contactId}`;
      if (this.entityCache.has(cacheKey)) {
        return this.entityCache.get(cacheKey);
      }
      
      const quotes = await this.storage.getQuotesByContact(contactId);
      this.entityCache.set(cacheKey, quotes);
      return quotes;
    } catch {
      return [];
    }
  }

  private async getContactContracts(contactId: string): Promise<Contract[]> {
    try {
      const cacheKey = `contracts:contact:${contactId}`;
      if (this.entityCache.has(cacheKey)) {
        return this.entityCache.get(cacheKey);
      }
      
      const contracts = await this.storage.getContractsByClient(contactId);
      this.entityCache.set(cacheKey, contracts);
      return contracts;
    } catch {
      return [];
    }
  }

  private async getProjectInvoices(projectId: string): Promise<Invoice[]> {
    try {
      const cacheKey = `invoices:project:${projectId}`;
      if (this.entityCache.has(cacheKey)) {
        return this.entityCache.get(cacheKey);
      }
      
      // This would need to be implemented - get invoices by project
      const allInvoices = await this.storage.getInvoices();
      const projectInvoices = allInvoices.filter(inv => inv.projectId === projectId);
      this.entityCache.set(cacheKey, projectInvoices);
      return projectInvoices;
    } catch {
      return [];
    }
  }
}

export const tokenResolverService = new TokenResolverService(storage);