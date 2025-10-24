# Overview

BusinessCRM is a comprehensive customer relationship management system designed to streamline business operations from lead capture through project completion and billing. It integrates lead management, client tracking, project management, a quotation system, contract management, invoicing, email and calendar functionalities, and workflow automation. Key features include an AI-powered conversational booking widget, a media library, an online scheduler, and an AI onboarding wizard for new tenants that guides them through initial setup via natural conversation. The project aims to deliver a modern, full-stack solution for effective customer relationship management.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The frontend uses React 18 with TypeScript and Vite. It employs a component-based architecture with `shadcn/ui` (built on Radix UI) for components, Tailwind CSS for styling, Wouter for routing, TanStack Query for server state management, and React Hook Form with Zod for form handling. The design emphasizes responsiveness with sidebar navigation.

## Backend
The backend is built with Express.js and TypeScript, featuring a layered, service-oriented architecture with RESTful APIs, an abstract storage layer, and middleware for request and error handling.

## Multitenancy
The system supports multitenancy with data isolation using `tenant_id` across core tables. Tenant resolution is achieved via subdomains, domains, or user context, with performance indexing on `tenant_id` columns. A "Tenant-Per-User" architecture ensures each new user gets an isolated tenant upon signup, with automatic admin role assignment and redirection to an AI onboarding wizard.

## Data Storage
PostgreSQL is the primary database, managed by Drizzle ORM for type-safe operations and migrations. Neon Database provides serverless PostgreSQL hosting. The schema includes tables for users, leads, clients, projects, quotes, contracts, invoices, tasks, emails, activities, and automations.

## Authentication & Session Management
The architecture includes session-based authentication using `connect-pg-simple` for PostgreSQL session storage, secure user management, and protected routes. The signup process handles tenant creation, user assignment, and session management before redirecting to onboarding.

## AI Assistant
The system incorporates an AI assistant using Replit AI Integrations (OpenAI) with multi-tenant safety.
-   **AI Email Assistant**: Provides summarization, smart replies, action item extraction, and a compose assistant with context-based style learning.
-   **Conversational CRM Assistant**: Enables natural language queries for business data across various CRM modules using OpenAI function calling with specialized database query functions.
-   **AI Training & Personalization System**: Allows users to train the AI via a business profile questionnaire, knowledge base, and custom instructions, with all data being tenant-scoped.
-   **Media Library & Conversational Chat Widget**: Provides a multi-tenant media library and an embeddable/full-page AI chat widget for conversational lead qualification, FAQ handling, and CRM integration.
-   **Online Scheduler**: Allows clients to book services with configurable durations, buffer times, and questions. Features include named availability schedules, Google Calendar integration for conflict detection, and automated email confirmations.
-   **AI Onboarding Wizard**: Guides new tenants through a comprehensive 11-step conversational setup process (Business Info, Branding, Contact Details, Services, Availability, Email Tone, Email/Calendar Integration, Chat Widget, Invoice Settings, Team Members, Knowledge Base) with skip/resume functionality and seamless OAuth automation.

## Invoice System
Includes a comprehensive invoicing system with payment schedules, recurring invoices, and Stripe integration. It supports custom/equal payment plans, flexible due dates, automated recurring invoices, multi-currency, and Stripe payments.

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