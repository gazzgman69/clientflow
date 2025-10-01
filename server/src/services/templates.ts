import { storage } from '../../storage';
import { InsertTemplate, Template } from '@shared/schema';
import { TokenResolverService, TokenResolutionContext } from './token-resolver';

export class TemplatesService {
  private tokenResolver: TokenResolverService;
  
  constructor() {
    this.tokenResolver = new TokenResolverService(storage as any);
  }
  /**
   * Get all templates with optional filtering
   */
  async listTemplates(options: {
    type?: 'auto_responder' | 'email' | 'invoice' | 'contract';
    q?: string;
    activeOnly?: boolean;
  } = {}): Promise<Template[]> {
    const templates = await storage.getTemplates();
    
    let filtered = templates;
    
    // Filter by type
    if (options.type) {
      filtered = filtered.filter((template: Template) => template.type === options.type);
    }
    
    // Filter by search query (title or body)
    if (options.q) {
      const query = options.q.toLowerCase();
      filtered = filtered.filter((template: Template) => 
        template.title.toLowerCase().includes(query) || 
        template.body.toLowerCase().includes(query)
      );
    }
    
    // Filter by active status
    if (options.activeOnly !== false) {
      filtered = filtered.filter((template: Template) => template.isActive);
    }
    
    return filtered.sort((a: Template, b: Template) => 
      new Date(b.updatedAt || Date.now()).getTime() - new Date(a.updatedAt || Date.now()).getTime()
    );
  }

  /**
   * Get a single template by ID
   * SECURITY FIX: Added tenant scoping to prevent cross-tenant template access
   */
  async getTemplate(id: string, tenantId: string): Promise<Template | null> {
    const template = await storage.getTemplate(id, tenantId);
    return template || null;
  }

  /**
   * Create a new template
   */
  async createTemplate(data: {
    type: 'auto_responder' | 'email' | 'invoice' | 'contract';
    title: string;
    subject?: string;
    body: string;
  }, tenantId: string): Promise<Template> {
    const templateData: InsertTemplate = {
      type: data.type,
      title: data.title,
      subject: data.subject || null,
      body: data.body,
      isActive: true
    };
    
    return await storage.createTemplate(templateData, tenantId);
  }

  /**
   * Update an existing template
   * SECURITY FIX: Added tenant scoping to prevent cross-tenant template access
   */
  async updateTemplate(id: string, data: {
    title?: string;
    subject?: string;
    body?: string;
    isActive?: boolean;
  }, tenantId: string): Promise<Template | null> {
    // Verify template exists and belongs to tenant
    const existing = await storage.getTemplate(id, tenantId);
    if (!existing) {
      return null;
    }

    const updateData: Partial<InsertTemplate> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.body !== undefined) updateData.body = data.body;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await storage.updateTemplate(id, updateData);
    return updated || null;
  }

  /**
   * Soft delete template (set isActive to false)
   * SECURITY FIX: Added tenant scoping to prevent cross-tenant template access
   */
  async softDeleteTemplate(id: string, tenantId: string): Promise<boolean> {
    // Verify template exists and belongs to tenant
    const existing = await storage.getTemplate(id, tenantId);
    if (!existing) {
      return false;
    }

    await storage.updateTemplate(id, { isActive: false });
    return true;
  }

  /**
   * Render template with comprehensive token replacement
   * Supports both legacy {{token}} and new [Token] formats
   */
  async renderTemplate(template: Template, context: TokenResolutionContext = {}): Promise<{
    subject: string | null;
    body: string;
    unresolved: string[];
  }> {
    const renderedSubject = template.subject 
      ? await this.tokenResolver.resolveTemplate(template.subject, context)
      : { rendered: null, unresolved: [] };
    
    const renderedBody = await this.tokenResolver.resolveTemplate(template.body, context);

    return {
      subject: renderedSubject.rendered,
      body: renderedBody.rendered,
      unresolved: [...renderedSubject.unresolved, ...renderedBody.unresolved]
    };
  }

  /**
   * Legacy method for backward compatibility with simple token replacement
   * @deprecated Use renderTemplate with TokenResolutionContext instead
   */
  renderTemplateLegacy(template: Template, tokens: Record<string, string>): {
    subject: string | null;
    body: string;
  } {
    let renderedSubject = template.subject;
    let renderedBody = template.body;

    // Replace tokens in subject and body
    Object.entries(tokens).forEach(([key, value]) => {
      const tokenPattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      if (renderedSubject) {
        renderedSubject = renderedSubject.replace(tokenPattern, value);
      }
      renderedBody = renderedBody.replace(tokenPattern, value);
    });

    return {
      subject: renderedSubject,
      body: renderedBody
    };
  }

  /**
   * Get available tokens from the comprehensive token registry
   * Maintains backward compatibility with legacy array format
   */
  async getAvailableTokens() {
    const tokens = await this.tokenResolver.getAvailableTokens();
    
    // Return both new and legacy formats for compatibility
    return {
      // New comprehensive format
      ...tokens,
      
      // Legacy array format for backward compatibility
      contact: ['contact.firstName', 'contact.lastName', 'contact.email', 'contact.phone', 'contact.company'],
      project: ['project.title', 'project.description', 'project.id', 'project.status'],
      lead: ['lead.service', 'lead.message', 'lead.email', 'lead.phone']
    };
  }
}

export const templatesService = new TemplatesService();