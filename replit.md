# Overview

BusinessCRM is a comprehensive customer relationship management system built with a modern full-stack architecture. The application provides lead management, client tracking, project management, quotation system, contract management, invoicing, email integration, calendar functionality, and workflow automation. It's designed to streamline business operations from lead capture through project completion and billing.

## Recent Changes (September 29, 2025)

**Email Provider OAuth Integration System**: Built comprehensive 17hats-style email provider catalog with production OAuth connectors for Google Gmail and Microsoft 365/Outlook. Implemented secure token storage with encryption, multi-tenant provider management, contacts-only email sync worker, and outgoing email dispatch with provider fallback. The system includes:
- Production Gmail and Microsoft OAuth flows with PKCE security
- Secure encrypted token storage (access/refresh tokens)
- Tenant-scoped provider integrations (one active provider per tenant)
- Background sync worker for contacts-only email ingestion
- Email dispatcher with Gmail→Microsoft fallback logic
- Updated Email Settings UI with OAuth connection management
- Structured logging for sync operations and error tracking

**Previous Changes (September 27, 2025)**: Comprehensive Multi-Tenant Security Audit & Hardening - Completed critical security audit that identified and resolved 16 major tenant isolation vulnerabilities in the storage layer. Implemented database-level constraints with NOT NULL tenant_id columns and foreign keys across all core tables.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client-side is built with React 18 using TypeScript and Vite as the build tool. The application follows a component-based architecture with:

- **UI Framework**: shadcn/ui components built on Radix UI primitives for accessible, customizable components
- **Styling**: Tailwind CSS with CSS variables for theming and a design system based on the "new-york" style
- **Routing**: Wouter for client-side routing with a simple, lightweight approach
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Forms**: React Hook Form with Zod validation for type-safe form handling
- **Layout**: Responsive design with a sidebar navigation and main content area

The frontend is organized into logical directories:
- `/pages` - Route components for each main section
- `/components` - Reusable UI components including layout, dashboard widgets, and modals
- `/lib` - Utility functions and configuration
- `/hooks` - Custom React hooks

## Backend Architecture
The server is built with Express.js using TypeScript and follows a layered architecture:

- **API Layer**: RESTful endpoints organized by resource (leads, clients, projects, etc.)
- **Storage Layer**: Abstract storage interface allowing for different database implementations
- **Middleware**: Request logging, JSON parsing, and error handling
- **Development Tools**: Vite integration for hot module replacement in development

The backend uses a service-oriented approach with clear separation between HTTP handling and business logic.

## Multitenancy Architecture
The system now includes scaffolding for multitenancy support to allow multiple organizations to use the same infrastructure:

- **Tenants Table**: Core tenant management with slug, domain, plan, and settings
- **Tenant Resolution**: Middleware for identifying tenant context from subdomain, domain, or user context
- **Data Isolation**: Tenant ID foreign keys added to core tables (users, leads, contacts, projects, quotes, contracts, invoices, tasks, emails)
- **Query Utilities**: Helper functions for tenant-aware database operations with proper data filtering
- **Security**: Whitelisted table names and proper reference handling for safe database operations

**Current Implementation Status:**
- ✅ Database schema with tenant_id columns on 10 core tables
- ✅ Tenant resolver middleware integrated into Express server
- ✅ Query utility functions for tenant-aware operations
- ✅ Performance indexes on all tenant_id columns
- ✅ Safe nullable references for existing data compatibility

**Next Steps for Production:**
1. **Enhanced Tenant Resolution**: Implement database-backed tenant lookup with domain validation
2. **Query Enforcement**: Apply tenant filtering across all storage operations and API routes
3. **Constraint Updates**: Make quote/invoice numbers unique per tenant instead of globally
4. **Missing Tables**: Add tenant_id to auxiliary tables (smsMessages, messageTemplates, activities, automations, members)
5. **Security Hardening**: Add requireTenant checks to sensitive routes and background services
6. **Data Migration**: Backfill existing data with default tenant and enforce NOT NULL constraints

## Data Storage
The application uses PostgreSQL as the primary database with:

- **ORM**: Drizzle ORM for type-safe database operations and migrations
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Schema Management**: Centralized schema definitions in `/shared/schema.ts`
- **Migrations**: Drizzle Kit for database schema migrations

The database schema includes comprehensive tables for users, leads, clients, projects, quotes, contracts, invoices, tasks, emails, activities, and automations with proper foreign key relationships.

## Email Provider OAuth Integration
The system includes a comprehensive email provider integration system modeled after 17hats:

- **Provider Catalog**: Database-backed email provider catalog with support for Gmail, Microsoft 365/Outlook
- **OAuth Flows**: Production OAuth 2.0 with PKCE for Gmail and Microsoft Graph API
- **Secure Token Storage**: Encrypted access/refresh token storage using AES-256-GCM
- **Multi-Tenant Support**: Tenant-scoped provider integrations with one-active-provider-per-tenant enforcement
- **Email Dispatch**: Outgoing email service with provider fallback (Gmail → Microsoft)
- **Background Sync**: Periodic email sync worker for contacts-only email ingestion
- **Provider Services**: 
  - `EmailProviderGmail`: Gmail API integration with OAuth, send, and contacts-only sync
  - `EmailProviderMicrosoft`: Microsoft Graph integration with OAuth, send, and contacts-only sync
  - `EmailDispatcher`: Provider-aware email dispatch with fallback logic
  - `EmailSyncWorker`: Background worker for periodic email ingestion

**Key Features:**
- PKCE-based OAuth flows for enhanced security
- Tenant isolation at database and service layers
- Automatic token refresh on expiration
- Structured JSON logging for monitoring
- Per-tenant email preferences and quotas
- Status tracking (connected/disconnected/error)

## Authentication & Session Management
While authentication routes aren't fully implemented in the current codebase, the architecture includes:

- Session-based authentication preparation with connect-pg-simple for PostgreSQL session storage
- User management schema with secure password handling
- Protected routes structure ready for implementation

## Development & Build Process
The build process uses:

- **Development**: Vite dev server with HMR and TypeScript checking
- **Production Build**: Vite for client bundle and esbuild for server bundle
- **TypeScript**: Strict configuration with path mapping for clean imports
- **Linting**: ESM modules with modern JavaScript features

# External Dependencies

## Core Framework Dependencies
- **React 18**: Frontend framework with hooks and modern features
- **Express.js**: Backend web framework
- **TypeScript**: Type safety across the entire stack
- **Vite**: Build tool and development server

## Database & ORM
- **Neon Database**: Serverless PostgreSQL database service
- **Drizzle ORM**: Type-safe database toolkit
- **connect-pg-simple**: PostgreSQL session store for Express

## UI & Component Libraries
- **Radix UI**: Accessible component primitives for complex UI components
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **shadcn/ui**: Pre-built component system

## Data Management
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form handling and validation
- **Zod**: TypeScript-first schema validation
- **date-fns**: Date manipulation utilities

## Development Tools
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Development tooling for Replit
- **PostCSS**: CSS processing with Autoprefixer

## Additional Utilities
- **clsx & tailwind-merge**: Conditional CSS class handling
- **class-variance-authority**: Component variant management
- **cmdk**: Command palette functionality
- **embla-carousel-react**: Carousel component functionality
- **wouter**: Lightweight routing library