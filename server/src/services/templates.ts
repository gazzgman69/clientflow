import { storage } from '../../storage';
import { InsertTemplate, Template } from '@shared/schema';

export class TemplatesService {
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
    
    return filtered.sort((a: Template, b: Template) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(id: string): Promise<Template | null> {
    return await storage.getTemplate(id);
  }

  /**
   * Create a new template
   */
  async createTemplate(data: {
    type: 'auto_responder' | 'email' | 'invoice' | 'contract';
    title: string;
    subject?: string;
    body: string;
  }): Promise<Template> {
    const templateData: InsertTemplate = {
      type: data.type,
      title: data.title,
      subject: data.subject || null,
      body: data.body,
      isActive: true
    };
    
    return await storage.createTemplate(templateData);
  }

  /**
   * Update an existing template
   */
  async updateTemplate(id: string, data: {
    title?: string;
    subject?: string;
    body?: string;
    isActive?: boolean;
  }): Promise<Template | null> {
    const existing = await storage.getTemplate(id);
    if (!existing) {
      return null;
    }

    const updateData: Partial<InsertTemplate> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.body !== undefined) updateData.body = data.body;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return await storage.updateTemplate(id, updateData);
  }

  /**
   * Soft delete template (set isActive to false)
   */
  async softDeleteTemplate(id: string): Promise<boolean> {
    const existing = await storage.getTemplate(id);
    if (!existing) {
      return false;
    }

    await storage.updateTemplate(id, { isActive: false });
    return true;
  }

  /**
   * Render template with token replacement
   */
  renderTemplate(template: Template, tokens: Record<string, string>): {
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
   * Get available template tokens for auto-responders
   */
  getAvailableTokens(): {
    contact: string[];
    project: string[];
    lead: string[];
  } {
    return {
      contact: ['contact.firstName', 'contact.lastName', 'contact.email'],
      project: ['project.title', 'project.date', 'project.id'],
      lead: ['lead.service', 'lead.message']
    };
  }
}

export const templatesService = new TemplatesService();