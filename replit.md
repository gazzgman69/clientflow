# Overview

BusinessCRM is a comprehensive customer relationship management system designed to streamline business operations from lead capture through project completion and billing. It offers lead management, client tracking, project management, a quotation system, contract management, invoicing, email integration, calendar functionality, and workflow automation. The project aims to provide a modern, full-stack solution for businesses to manage their customer relationships effectively.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client-side is built with React 18, TypeScript, and Vite. It utilizes a component-based architecture with `shadcn/ui` (built on Radix UI) for components, Tailwind CSS for styling, Wouter for routing, TanStack Query for server state management, and React Hook Form with Zod for form handling. The layout is responsive with a sidebar navigation.

## Backend Architecture
The server is built with Express.js and TypeScript, following a layered architecture. It features RESTful APIs, an abstract storage layer, and middleware for request handling and error management. A service-oriented approach separates HTTP handling from business logic.

## Multitenancy Architecture
The system includes scaffolding for multitenancy, allowing multiple organizations to use the same infrastructure. Key aspects include a `Tenants` table, middleware for tenant resolution (subdomain, domain, user context), data isolation using `tenant_id` foreign keys across core tables, and helper functions for tenant-aware database operations. Performance indexes are applied to `tenant_id` columns.

## Data Storage
PostgreSQL is the primary database, utilizing Drizzle ORM for type-safe operations and migrations. Neon Database provides serverless PostgreSQL hosting. The schema, defined in `/shared/schema.ts`, includes tables for users, leads, clients, projects, quotes, contracts, invoices, tasks, emails, activities, and automations.

## Email Provider OAuth Integration & Performance
The system incorporates a comprehensive email provider integration system. This includes a database-backed provider catalog supporting Gmail and Microsoft 365/Outlook, secure OAuth 2.0 flows with PKCE, encrypted token storage, and multi-tenant support with one-active-provider-per-tenant enforcement. It features an outgoing email service with provider fallback and a background worker for contacts-only email synchronization. Automatic calendar event creation for leads with Google Calendar sync conflict resolution is also implemented, ensuring CRM-created events are protected from overwrites and support cascade deletion with projects.

**Email Loading Performance**: Emails are fetched from Gmail API and stored in PostgreSQL with composite indexes (`projectId`, `sentAt`) for instant retrieval. TanStack Query caches email data with a 5-minute staleTime for instant loading on subsequent visits, matching 17hats performance standards. Manual refresh available via UI when needed.

## Authentication & Session Management
The architecture includes preparations for session-based authentication using `connect-pg-simple` for PostgreSQL session storage, user management schema with secure password handling, and a structure for protected routes.

## AI Assistant (Phase 1)
The system includes an AI-powered email assistant using Replit AI Integrations (OpenAI). All AI operations are multi-tenant safe with proper data isolation.

**Features:**
- **Email Summarization**: AI generates concise summaries of email threads, focusing on main topics, decisions, and action items
- **Smart Reply Drafts**: AI creates professional email reply drafts based on thread context
- **Action Item Extraction**: AI automatically identifies tasks, deadlines, and priorities from email content
- **AI Compose Assistant with Style Learning**: AI generates complete email drafts (subject + body) from brief user instructions
  - **Context-Based Style Learning**: Analyzes user's recent sent emails to match their personal writing style, tone, and structure
  - **Adaptive Personalization**: <3 emails = standard professional style, 3-5 emails = blended style, 6+ emails = fully personalized to user's voice
  - **User Feedback**: Toast notifications indicate whether draft uses personalized style or standard style with guidance to send more emails

**Multi-Tenant Safety:**
- All AI operations scope data by `tenant_id` in database queries and AI prompts
- Database tables (`email_summaries`, `email_drafts`, `email_action_items`) have NOT NULL tenant_id constraints
- Backend routes protected with authentication, tenant resolution, and tenant validation middleware
- Storage methods enforce tenant isolation using `AND tenant_id = ?` in all queries

**Caching Strategy:**
- Email summaries cached in database with unique constraint on (tenant_id, thread_id)
- Backend checks for existing summaries before generating new ones
- Prevents redundant API calls and reduces costs

**AI Service:**
- Located in `server/ai-service.ts`
- Uses GPT-4o-mini model for cost-effective performance
- All functions accept `tenantId` parameter for safety (composeEmail also accepts `userId` for style learning)
- Returns token usage for tracking and cost management
- Style learning queries user's email address from users table, then fetches recent sent emails (direction='outbound') matching that email
- Returns `stylePersonalized: boolean` flag to inform frontend about personalization level

# External Dependencies

## Core Framework Dependencies
- **React 18**: Frontend framework
- **Express.js**: Backend web framework
- **TypeScript**: Language
- **Vite**: Build tool and development server

## Database & ORM
- **Neon Database**: Serverless PostgreSQL
- **Drizzle ORM**: Type-safe database toolkit
- **connect-pg-simple**: PostgreSQL session store

## UI & Component Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library
- **shadcn/ui**: Pre-built component system

## Data Management
- **TanStack Query**: Server state management
- **React Hook Form**: Form handling
- **Zod**: Schema validation
- **date-fns**: Date manipulation utilities

## Additional Utilities
- **clsx & tailwind-merge**: Conditional CSS class handling
- **class-variance-authority**: Component variant management
- **cmdk**: Command palette functionality
- **embla-carousel-react**: Carousel component
- **wouter**: Routing library

## AI & Machine Learning
- **Replit AI Integrations**: OpenAI-compatible API access (GPT-4o-mini/GPT-5)
- **OpenAI SDK**: Client library for AI operations