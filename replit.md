# Overview

BusinessCRM is a comprehensive customer relationship management system designed to streamline business operations from lead capture through project completion and billing. It integrates lead management, client tracking, project management, a quotation system, contract management, invoicing, email and calendar functionalities, and workflow automation. Key features include an AI-powered conversational booking widget, a media library, an online scheduler, and an AI onboarding wizard for new tenants. The project aims to deliver a modern, full-stack solution for effective customer relationship management.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend uses React 18 with TypeScript and Vite. It employs a component-based architecture with `shadcn/ui` (built on Radix UI) for components, Tailwind CSS for styling, Wouter for routing, TanStack Query for server state management, and React Hook Form with Zod for form handling. The design emphasizes responsiveness with sidebar navigation.

## Backend
The backend is built with Express.js and TypeScript, featuring a layered, service-oriented architecture with RESTful APIs, an abstract storage layer, and middleware for request and error handling.

## Multitenancy
The system supports multitenancy with data isolation using `tenant_id` across core tables, tenant resolution via subdomains, domains, or user context, and performance indexing on `tenant_id` columns.

## Data Storage
PostgreSQL is the primary database, managed by Drizzle ORM for type-safe operations and migrations. Neon Database provides serverless PostgreSQL hosting. The schema includes tables for users, leads, clients, projects, quotes, contracts, invoices, tasks, emails, activities, and automations.

## Email Provider Integration
The system integrates with email providers like Gmail and Microsoft 365/Outlook, featuring secure OAuth 2.0 flows, encrypted token storage, multi-tenant support with one active provider per tenant, and an outgoing email service with fallback. It includes background email synchronization for contacts and automatic Google Calendar event creation for leads with conflict resolution. Email data is fetched from the Gmail API, stored in PostgreSQL with composite indexes, and cached by TanStack Query for fast retrieval.

## Authentication & Session Management
The architecture includes session-based authentication using `connect-pg-simple` for PostgreSQL session storage, secure user management, and protected routes.

## AI Assistant
The system incorporates an AI assistant using Replit AI Integrations (OpenAI) with multi-tenant safety.

### AI Email Assistant
Provides email summarization, smart reply drafts, action item extraction, and an AI compose assistant with context-based style learning. Personalization adapts to user's past email styles, with a feedback mechanism for personalization level. AI operations are tenant-scoped, and summaries are cached to reduce API calls. The service uses GPT-4o-mini.

### Conversational CRM Assistant
Enables natural language queries for business data across projects, leads, clients, quotes, contracts, invoices, tasks, calendar events, team members, venues, activities, and emails. It uses OpenAI function calling with 16 specialized database query functions to provide smart insights and formatted responses. The service is implemented via a floating chat button.

### AI Training & Personalization System
Allows users to train the AI assistant through:
-   **Business Profile Questionnaire**: Captures essential business information, target audience, services, and communication style.
-   **Knowledge Base**: Manages business-specific articles with category tagging and CRUD operations.
-   **Custom Instructions**: Defines AI behavioral guidelines.
All training data is tenant-scoped and dynamically enhances the AI's system message for personalized responses.

### Media Library & Conversational Chat Widget
Provides a multi-tenant media library for organizing and displaying files (photos, videos, audio) with categories and tags. The AI chat widget offers:
-   **Deployment**: Embeddable widget or full contact page.
-   **Lead Capture**: Conversational lead qualification, FAQ handling, media sharing, and conditional booking flows for new and existing contacts.
-   **CRM Integration**: Auto-creates contacts, leads, or projects.
-   **Configuration**: Customizable welcome messages, branding, tone, and booking prompt aggressiveness.

### Online Scheduler & AI Onboarding Wizard
**Online Scheduler**: Allows clients to book services with configurable durations, buffer times, and questions. Features include:
-   **Availability**: Named schedules with daily/weekly/monthly patterns and exception rules.
-   **Management**: Auto-creates contacts/projects, updates project dates, integrates with Google Calendar (conflict detection), and manages booking statuses.
-   **Automation**: Customizable email confirmations and reminders.
-   **Client Experience**: Public booking pages with timezone support and existing contact detection.
**AI Onboarding Wizard**: Guides new tenants through a conversational setup process for their CRM, configuring business information, services, scheduler, knowledge base, and chat widget. It extracts structured data and auto-populates CRM settings.

## Invoice System
Includes a comprehensive invoicing system with payment schedules, recurring invoices, and Stripe integration. It features full database schema, CRUD operations, and API routes for invoices, line items, payment schedules, installments, recurring settings, and transactions. Supports custom/equal payment plans, flexible due dates, automated recurring invoices, multi-currency, and Stripe payments.

# External Dependencies

## Core Framework
-   **React 18**
-   **Express.js**
-   **TypeScript**
-   **Vite**

## Database & ORM
-   **Neon Database** (Serverless PostgreSQL)
-   **Drizzle ORM**
-   **connect-pg-simple** (PostgreSQL session store)

## UI & Component Libraries
-   **Radix UI**
-   **Tailwind CSS**
-   **Lucide React**
-   **shadcn/ui**

## Data Management
-   **TanStack Query**
-   **React Hook Form**
-   **Zod**
-   **date-fns**

## Additional Utilities
-   **clsx & tailwind-merge**
-   **class-variance-authority**
-   **cmdk**
-   **embla-carousel-react**
-   **wouter**

## AI & Machine Learning
-   **Replit AI Integrations** (OpenAI-compatible API access)
-   **OpenAI SDK**