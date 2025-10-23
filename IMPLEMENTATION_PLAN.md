# Complete Implementation & Verification Plan

**Project:** Multi-Tenant Business CRM with AI Features  
**Created:** Based on full conversation history analysis  
**Status:** Ready for implementation and verification

---

## 📋 Overview

This document contains the comprehensive 68-task plan for implementing and verifying four major AI-powered features in the BusinessCRM system:

1. **AI Onboarding Wizard** - Conversational setup for new tenants
2. **Media Library** - Organize photos/videos/audio for AI to use
3. **AI Chat Widget** - Public-facing conversational lead capture
4. **Online Scheduler** - 17hats-style booking system with conditional forms

---

## 🎯 Key Requirements from Conversation

### AI Onboarding Wizard
- ✅ **Trigger:** Automatically on first signup/login for new tenant
- ✅ **Skip Functionality:** Skip button with message "You can resume this from Settings later"
- ✅ **Resume:** Can resume onboarding from Settings page
- ✅ **Redirect:** Completion redirects to dashboard

### AI Chat Widget
- ✅ **Public URL:** `/contact/[tenantSlug]` format
- ✅ **Embeddable:** Generate embed code in Settings > Widget Settings
- ✅ **Behavior:** Gentle booking prompts (not pushy), but option to book immediately if user wants
- ✅ **Lead Capture:** Conversational lead qualification and CRM creation
- ✅ **Media Integration:** AI shares photos/videos from media library during conversation
- ✅ **FAQ Answering:** Uses knowledge base from onboarding

### Online Scheduler
- ✅ **Contact Detection:** Email only (not phone)
- ✅ **Conditional Forms:**
  - Simple form for existing contacts (name, phone, service questions)
  - Extended form for new contacts (+ project setup questions: event date, type, venue)
- ✅ **Performance:** Email lookup must be <50ms
- ✅ **Project Linking:** Links to most recent project for existing contacts
- ✅ **Auto-Creation:** Creates full project for new contacts with all captured details
- ✅ **Calendar Sync:** Google Calendar integration with conflict detection
- ✅ **Timezone Support:** Clients see times in their timezone

### Media Library
- ✅ **File Size Limit:** 50MB maximum
- ✅ **File Types:** Photos (JPEG, PNG), videos, audio
- ✅ **Organization:** Categories and tags
- ✅ **AI Integration:** AI can retrieve and share media in conversations

---

## 🔍 Current Implementation Status

### ✅ Already Implemented (But Not Fully Wired)
- `client/src/pages/onboarding.tsx` - AI Onboarding page EXISTS and IS ROUTED at `/onboarding`
- `client/src/pages/media-library.tsx` - File EXISTS but NO ROUTE in App.tsx
- `client/src/pages/settings/WidgetSettings.tsx` - File EXISTS but NO ROUTE in App.tsx
- Backend AI services exist:
  - `server/src/services/ai-onboarding-wizard.ts`
  - `server/src/services/ai-chat-widget.ts`
- Database schema includes required tables for onboarding, media, widget settings

### ❌ Missing/Incomplete
- **Scheduler Page:** Does NOT exist (`client/src/pages/scheduler.tsx` missing)
- **Public Chat Widget Route:** No `/contact/[slug]` route in App.tsx
- **Routes:** Media Library and Widget Settings not accessible from navigation
- **Scheduler Backend:** Service configuration, availability rules, booking logic may be incomplete
- **Public Booking Page:** No public scheduler route for clients to book

---

## 📝 Implementation & Verification Task List

### Priority Order
1. AI Onboarding Wizard (Tasks 1-12)
2. Media Library (Tasks 13-17)
3. AI Chat Widget (Tasks 18-29)
4. Widget Settings (Tasks 30-33)
5. Online Scheduler (Tasks 34-55)
6. Integration Testing (Tasks 56-64)
7. Multi-Tenancy (Tasks 65-67)
8. End-to-End Journey (Task 68)

---

## 🤖 AI Onboarding Wizard (Tasks 1-12)

**Goal:** New tenants set up their CRM through conversational AI chat

| Task | Description | Status |
|------|-------------|--------|
| 1 | Verify wizard triggers automatically on first signup/login for new tenant | ⬜ Pending |
| 2 | Verify conversation flow starts with greeting and asks for business information | ⬜ Pending |
| 3 | Verify business info extraction (name, industry, target audience, description) | ⬜ Pending |
| 4 | Verify services configuration capture (name, duration, price, description) | ⬜ Pending |
| 5 | Verify availability schedule setup (working hours, timezone, days of week) | ⬜ Pending |
| 6 | Verify widget configuration capture (welcome message, brand color, tone) | ⬜ Pending |
| 7 | Verify knowledge base article creation from conversation | ⬜ Pending |
| 8 | Verify 'Skip' button shows message about resuming from settings | ⬜ Pending |
| 9 | Verify resume functionality from Settings after skipping | ⬜ Pending |
| 10 | Verify completion redirects to dashboard and marks onboarding complete | ⬜ Pending |
| 11 | Verify extracted data is properly stored in database (business profile, services, schedules, widget settings, knowledge base) | ⬜ Pending |
| 12 | Verify progress tracking through steps (business_info → services → availability → widget_config → complete) | ⬜ Pending |

**Key Features:**
- Conversational AI guides setup process
- Can be skipped and resumed from Settings
- Extracts structured data from natural conversation
- Auto-populates business profile, services, scheduler, widget settings, knowledge base

---

## 📸 Media Library (Tasks 13-17)

**Goal:** Upload and organize media that AI can share in conversations

| Task | Description | Status |
|------|-------------|--------|
| 13 | Verify file upload for photos (JPEG, PNG) up to 50MB limit | ⬜ Pending |
| 14 | Verify file upload for videos and audio files up to 50MB limit | ⬜ Pending |
| 15 | Verify category organization and filtering by category | ⬜ Pending |
| 16 | Verify tag system for organizing media items | ⬜ Pending |
| 17 | Verify media retrieval for AI chat widget integration | ⬜ Pending |

**Key Features:**
- Upload photos, videos, audio clips
- Organize by categories (weddings, corporate, lighting setups, etc.)
- Tag items for AI to find relevant media
- AI shares media during chat conversations

---

## 💬 AI Chat Widget (Tasks 18-29)

**Goal:** Public-facing conversational AI for lead capture and booking

| Task | Description | Status |
|------|-------------|--------|
| 18 | Verify public contact page accessible at `/contact/[tenantSlug]` | ⬜ Pending |
| 19 | Verify widget displays custom welcome message from settings | ⬜ Pending |
| 20 | Verify conversation start and AI responds appropriately | ⬜ Pending |
| 21 | Verify FAQ answering using knowledge base from onboarding | ⬜ Pending |
| 22 | Verify media sharing (AI shows photos from media library when relevant) | ⬜ Pending |
| 23 | Verify lead qualification through conversational data collection | ⬜ Pending |
| 24 | Verify contact info capture (name, email, phone) and lead creation in CRM | ⬜ Pending |
| 25 | Verify existing contact detection by email only | ⬜ Pending |
| 26 | Verify availability checking without actual booking (general availability responses) | ⬜ Pending |
| 27 | Verify gentle booking prompt appears but doesn't force booking | ⬜ Pending |
| 28 | Verify full booking flow when user explicitly wants to book immediately | ⬜ Pending |
| 29 | Verify booking links to most recent project for existing contacts | ⬜ Pending |

**Key Features:**
- Public URL: `/contact/[tenantSlug]`
- Answers FAQs using business knowledge
- Shows photos/videos from media library
- Qualifies leads conversationally
- Creates leads in CRM automatically
- Gentle booking prompts (not pushy)
- Can book immediately if client wants
- 24/7 intelligent receptionist

---

## ⚙️ Widget Settings (Tasks 30-33)

**Goal:** Configure and customize the AI chat widget

| Task | Description | Status |
|------|-------------|--------|
| 30 | Verify embeddable code generation in Settings | ⬜ Pending |
| 31 | Verify welcome message customization | ⬜ Pending |
| 32 | Verify brand color and tone configuration | ⬜ Pending |
| 33 | Verify booking prompt aggressiveness slider (gentle to pushy) | ⬜ Pending |

**Key Features:**
- Generate embed code for external websites
- Customize welcome message
- Set brand colors and tone
- Adjust booking prompt aggressiveness

---

## 📅 Online Scheduler (Tasks 34-55)

**Goal:** 17hats-style booking system with smart conditional forms

| Task | Description | Status |
|------|-------------|--------|
| 34 | Verify bookable services configuration (name, description, duration, price) | ⬜ Pending |
| 35 | Verify service buffer times (before/after appointments) | ⬜ Pending |
| 36 | Verify service questions configuration (always asked) | ⬜ Pending |
| 37 | Verify project setup questions (only for new contacts without projects) | ⬜ Pending |
| 38 | Verify availability schedules creation with named schedules | ⬜ Pending |
| 39 | Verify availability rules (daily/weekly patterns, time ranges) | ⬜ Pending |
| 40 | Verify availability exceptions (block specific dates) | ⬜ Pending |
| 41 | Verify booking limitations (min advance notice, max future booking) | ⬜ Pending |
| 42 | Verify public booking page shows available time slots | ⬜ Pending |
| 43 | Verify conditional booking form shows simple form for existing contacts (email detection) | ⬜ Pending |
| 44 | Verify conditional booking form shows extended form with project setup questions for new contacts | ⬜ Pending |
| 45 | Verify fast email lookup performance (<50ms) for contact detection | ⬜ Pending |
| 46 | Verify booking creates new project for new contacts with all captured details | ⬜ Pending |
| 47 | Verify booking links to most recent project for existing contacts | ⬜ Pending |
| 48 | Verify project date updates to booking time when configured | ⬜ Pending |
| 49 | Verify project tags are applied on booking creation | ⬜ Pending |
| 50 | Verify Google Calendar event creation on booking confirmation | ⬜ Pending |
| 51 | Verify Google Calendar conflict detection prevents double booking | ⬜ Pending |
| 52 | Verify timezone support (client sees times in their timezone) | ⬜ Pending |
| 53 | Verify confirmation email sent to client after booking | ⬜ Pending |
| 54 | Verify reminder emails (1-day before, day-of) if configured | ⬜ Pending |
| 55 | Verify cancellation flow and cancellation email | ⬜ Pending |

**Key Features:**
- Configure bookable services (like 17hats)
- Set availability schedules with flexible rules
- **Smart Conditional Forms:**
  - Existing contacts: simple form (name, phone, basic questions)
  - New contacts: extended form (+ event date, type, venue)
- Auto-creates projects for new contacts
- Links to most recent project for existing contacts
- Google Calendar sync with conflict detection
- Email confirmations and reminders
- Timezone-aware booking

**Example Flow:**
1. User visits `/book/club-kudo`
2. Enters email → System checks if contact exists (<50ms)
3. **If existing:** Shows simple form
4. **If new:** Shows extended form with project setup questions
5. Books → Creates/links project → Syncs to Google Calendar → Sends confirmation

---

## 🔗 Integration Testing (Tasks 56-64)

**Goal:** Verify all systems work together seamlessly

| Task | Description | Status |
|------|-------------|--------|
| 56 | Verify onboarding wizard data flows correctly to Settings pages | ⬜ Pending |
| 57 | Verify AI chat widget uses knowledge base from onboarding | ⬜ Pending |
| 58 | Verify AI chat widget uses business profile data in responses | ⬜ Pending |
| 59 | Verify widget uses scheduler availability to check dates | ⬜ Pending |
| 60 | Verify widget booking flow uses scheduler services and rules | ⬜ Pending |
| 61 | Verify bookings from chat widget create leads/projects in CRM | ⬜ Pending |
| 62 | Verify bookings from scheduler create leads/projects in CRM | ⬜ Pending |
| 63 | Verify bookings appear in calendar with linked project info | ⬜ Pending |
| 64 | Verify bookings sync to Google Calendar bidirectionally | ⬜ Pending |

**Integration Points:**
- Onboarding → Settings (data persistence)
- Onboarding → Chat Widget (knowledge base, business profile)
- Onboarding → Scheduler (services, availability)
- Media Library → Chat Widget (media sharing)
- Chat Widget → Scheduler (booking flow)
- Scheduler → CRM (lead/project creation)
- Scheduler → Calendar (event sync)

---

## 🔒 Multi-Tenancy (Tasks 65-67)

**Goal:** Verify complete data isolation between tenants

| Task | Description | Status |
|------|-------------|--------|
| 65 | Verify complete data isolation between two different tenants | ⬜ Pending |
| 66 | Verify each tenant has unique contact page URL based on slug | ⬜ Pending |
| 67 | Verify tenants cannot access each other's data | ⬜ Pending |

**Test Scenarios:**
- Create two separate tenants (Tenant A, Tenant B)
- Each goes through onboarding
- Upload different media
- Configure different schedulers
- Verify Tenant A cannot see Tenant B's data
- Verify URLs are unique: `/contact/tenant-a` vs `/contact/tenant-b`

---

## 🎬 Final End-to-End Journey (Task 68)

**Goal:** Complete user journey from signup to booking

| Task | Description | Status |
|------|-------------|--------|
| 68 | Complete flow: Signup → Onboarding → Media → Scheduler → Widget → Booking → Calendar | ⬜ Pending |

**Full Journey:**
1. New user signs up → Creates tenant with unique slug
2. AI Onboarding Wizard → Sets up business profile, services, availability, widget
3. Upload media → Photos of setups, videos, audio samples
4. Configure scheduler → Services, availability rules
5. Public visitor → Goes to `/contact/[slug]`
6. Chat with AI → Asks questions, sees media, gets qualified
7. Books appointment → Creates project, syncs to calendar
8. Verify in CRM → Lead created, project linked, calendar event exists

---

## 📊 Success Criteria

### Must Have (MVP)
- ✅ AI Onboarding works for new tenants
- ✅ Media Library functional with AI integration
- ✅ Public chat widget at `/contact/[slug]` works
- ✅ Scheduler allows public bookings
- ✅ Bookings create leads/projects in CRM
- ✅ Google Calendar sync works
- ✅ Multi-tenant isolation verified

### Nice to Have (Future)
- Widget embed on external websites
- Advanced scheduler features (team assignments, recurring bookings)
- AI voice messages in chat
- Real-time availability in chat
- Analytics dashboard for conversions

---

## 🛠️ Implementation Notes

### Technical Stack
- **Frontend:** React 18, TypeScript, Wouter, TanStack Query
- **Backend:** Express.js, TypeScript
- **Database:** PostgreSQL (Neon) with Drizzle ORM
- **AI:** Replit AI Integrations (OpenAI-compatible)
- **Calendar:** Google Calendar API (OAuth already set up)
- **Email:** Nodemailer with Gmail/Microsoft 365 integration

### Database Tables Required
- `tenant_onboarding_progress` ✅ (exists)
- `media_library` ✅ (exists)
- `widget_settings` ✅ (exists)
- `bookable_services` ✅ (exists)
- `availability_schedules` ✅ (exists)
- `availability_rules` ✅ (exists)
- `bookings` ✅ (exists)
- `chat_conversations` ✅ (exists)
- `chat_messages` ✅ (exists)

### Routes to Add/Fix
- ✅ `/onboarding` - Already routed
- ❌ `/media-library` - Need to add route
- ❌ `/settings/widget` - Need to add route
- ❌ `/scheduler` or `/settings/scheduler` - Need to create page + route
- ❌ `/contact/:slug` - Need to create public chat widget page + route
- ❌ `/book/:slug` or `/book/:slug/:serviceId` - Need to create public booking page + route

---

## 📅 Estimated Timeline

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| AI Onboarding Wizard | 1-12 | 2-3 days |
| Media Library | 13-17 | 1 day |
| AI Chat Widget | 18-29 | 3-4 days |
| Widget Settings | 30-33 | 1 day |
| Online Scheduler | 34-55 | 5-7 days |
| Integration Testing | 56-64 | 2-3 days |
| Multi-Tenancy & E2E | 65-68 | 1-2 days |
| **Total** | **68 tasks** | **15-20 days** |

---

## 🔄 Next Steps

1. **Review current implementation** - Check what exists vs what's missing
2. **Start with AI Onboarding** - Test if it works end-to-end
3. **Build missing pieces** - Scheduler page, public routes
4. **Wire up existing pages** - Add routes for media library, widget settings
5. **Test systematically** - Go through each task one by one
6. **Fix bugs** - Debug issues as they arise
7. **Integrate features** - Ensure everything connects properly
8. **Verify multi-tenancy** - Test data isolation
9. **End-to-end test** - Complete journey from signup to booking

---

**Document Status:** ✅ Saved and Won't Be Lost  
**Last Updated:** From full conversation history  
**Ready For:** Implementation and Verification
