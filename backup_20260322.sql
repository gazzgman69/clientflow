--
-- PostgreSQL database dump
--

\restrict yfGbgzjy8lDkbOB1Ybaa0OzTUuZgX9xY6KGHzloNLuccXAkyr0waKnE2PIKshwB

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO postgres;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: extract_email_address(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.extract_email_address(email_string text) RETURNS text
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Extract email from formats like "Display Name <email@domain.com>" or plain "email@domain.com"
    IF email_string ~ '<[^>]+>' THEN
        -- Extract email from angle brackets
        RETURN substring(email_string from '<([^>]+)>');
    ELSE
        -- Already plain format, just trim and return
        RETURN trim(email_string);
    END IF;
END;
$$;


ALTER FUNCTION public.extract_email_address(email_string text) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: postgres
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO postgres;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: postgres
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO postgres;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: postgres
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activities (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    description text NOT NULL,
    entity_type text,
    entity_id character varying,
    user_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL,
    contact_id character varying
);


ALTER TABLE public.activities OWNER TO postgres;

--
-- Name: admin_audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_audit_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    admin_user_id character varying NOT NULL,
    impersonated_user_id character varying,
    tenant_id character varying,
    action text NOT NULL,
    details text,
    ip_address text,
    user_agent text,
    session_id text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.admin_audit_logs OWNER TO postgres;

--
-- Name: ai_business_context; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_business_context (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    business_name text,
    business_type text,
    industry text,
    services text,
    pricing_info text,
    business_hours text,
    target_audience text,
    brand_voice text,
    terminology text,
    standard_responses text,
    policies text,
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ai_business_context OWNER TO postgres;

--
-- Name: ai_custom_instructions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_custom_instructions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    instruction text NOT NULL,
    category text,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ai_custom_instructions OWNER TO postgres;

--
-- Name: ai_knowledge_base; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_knowledge_base (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    title text NOT NULL,
    category text,
    content text NOT NULL,
    tags text,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0,
    created_by character varying,
    updated_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ai_knowledge_base OWNER TO postgres;

--
-- Name: ai_training_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_training_documents (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    file_name text NOT NULL,
    file_type text,
    file_size integer,
    file_path text NOT NULL,
    extracted_text text,
    category text,
    is_processed boolean DEFAULT false,
    uploaded_by character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.ai_training_documents OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    user_id character varying NOT NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id character varying,
    metadata text,
    ip_address text,
    user_agent text,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: auto_reply_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auto_reply_log (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    lead_id character varying NOT NULL,
    email_id character varying,
    message text NOT NULL,
    sent_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.auto_reply_log OWNER TO postgres;

--
-- Name: auto_responder_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auto_responder_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    lead_id character varying NOT NULL,
    template_id character varying NOT NULL,
    form_id character varying,
    provider text,
    status text DEFAULT 'queued'::text NOT NULL,
    error_code text,
    error_message text,
    provider_message_id text,
    retry_count integer DEFAULT 0,
    scheduled_for timestamp without time zone NOT NULL,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.auto_responder_logs OWNER TO postgres;

--
-- Name: automations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.automations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    trigger text NOT NULL,
    actions text[] NOT NULL,
    is_active boolean DEFAULT true,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.automations OWNER TO postgres;

--
-- Name: availability_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.availability_rules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    schedule_id character varying NOT NULL,
    frequency text NOT NULL,
    selected_days text[],
    date_start timestamp without time zone,
    date_end timestamp without time zone,
    time_start text NOT NULL,
    time_end text NOT NULL,
    is_exception boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.availability_rules OWNER TO postgres;

--
-- Name: availability_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.availability_schedules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name text NOT NULL,
    public_link text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    min_advance_notice_hours integer,
    max_future_days integer,
    daily_booking_limit integer,
    weekly_booking_limit integer,
    cancellation_policy_hours integer,
    header_image_url text
);


ALTER TABLE public.availability_schedules OWNER TO postgres;

--
-- Name: bookable_services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookable_services (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name text NOT NULL,
    description text,
    service_type text DEFAULT 'individual'::text,
    duration integer NOT NULL,
    buffer_before integer DEFAULT 0,
    buffer_after integer DEFAULT 0,
    start_time_interval integer DEFAULT 30,
    service_questions text,
    project_questions text,
    require_phone boolean DEFAULT false,
    enable_online_payments boolean DEFAULT false,
    payment_amount numeric(10,2),
    payment_type text,
    location text,
    location_details text,
    confirmation_message_template_id character varying,
    cancellation_message_template_id character varying,
    reminder_message_template_id character varying,
    reminder_days_before integer DEFAULT 1,
    auto_create_project boolean DEFAULT false,
    add_contact_tags text[],
    add_project_tags text[],
    remove_project_tags text[],
    update_project_date_to_booking boolean DEFAULT false,
    require_approval boolean DEFAULT false,
    approval_calendar_id character varying,
    approval_workflow_id text,
    approval_auto_email text,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.bookable_services OWNER TO postgres;

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bookings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    service_id character varying NOT NULL,
    schedule_id character varying,
    contact_id character varying,
    lead_id character varying,
    project_id character varying,
    booked_by text NOT NULL,
    booked_email text NOT NULL,
    booked_phone text,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    service_responses text,
    project_responses text,
    status text DEFAULT 'pending'::text NOT NULL,
    approval_status text,
    google_event_id text,
    confirmation_sent_at timestamp without time zone,
    reminder_sent_at timestamp without time zone,
    cancellation_sent_at timestamp without time zone,
    cancelled_at timestamp without time zone,
    cancelled_by text,
    cancellation_reason text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.bookings OWNER TO postgres;

--
-- Name: calendar_integrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_integrations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    provider text NOT NULL,
    provider_account_id text,
    calendar_id text,
    calendar_name text NOT NULL,
    access_token text,
    refresh_token text,
    sync_token text,
    webhook_id text,
    is_active boolean DEFAULT true,
    sync_direction text DEFAULT 'bidirectional'::text NOT NULL,
    last_sync_at timestamp without time zone,
    sync_errors text,
    settings text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL,
    service_type text DEFAULT 'calendar'::text NOT NULL,
    connected_at timestamp without time zone DEFAULT now(),
    disconnected_at timestamp without time zone,
    disconnect_reason text
);


ALTER TABLE public.calendar_integrations OWNER TO postgres;

--
-- Name: calendar_sync_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_sync_log (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    integration_id character varying NOT NULL,
    sync_type text NOT NULL,
    direction text NOT NULL,
    events_processed integer DEFAULT 0,
    events_created integer DEFAULT 0,
    events_updated integer DEFAULT 0,
    events_deleted integer DEFAULT 0,
    errors text,
    started_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone,
    status text DEFAULT 'processing'::text NOT NULL
);


ALTER TABLE public.calendar_sync_log OWNER TO postgres;

--
-- Name: calendars; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendars (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#3b82f6'::text NOT NULL,
    type text NOT NULL,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.calendars OWNER TO postgres;

--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_conversations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    visitor_email text,
    visitor_name text,
    contact_id character varying,
    lead_id character varying,
    session_id text NOT NULL,
    ip_address text,
    user_agent text,
    is_converted boolean DEFAULT false,
    conversion_type text,
    lead_quality_score integer,
    last_message_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.chat_conversations OWNER TO postgres;

--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    conversation_id character varying NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    media_urls text[],
    function_called text,
    function_result text,
    tokens_used integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- Name: contact_field_definitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_field_definitions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name text NOT NULL,
    label text NOT NULL,
    field_type text NOT NULL,
    options text[],
    required boolean DEFAULT false,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.contact_field_definitions OWNER TO postgres;

--
-- Name: contact_field_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contact_field_values (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    contact_id character varying NOT NULL,
    field_definition_id character varying NOT NULL,
    value text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.contact_field_values OWNER TO postgres;

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contacts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    company text,
    address text,
    city text,
    state text,
    zip_code text,
    country text,
    lead_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    job_title text,
    website text,
    tags text[],
    lead_source text,
    notes text,
    venue_address text,
    venue_city text,
    venue_state text,
    venue_zip_code text,
    venue_country text,
    venue_id character varying,
    full_name text,
    middle_name text,
    user_id character varying,
    tenant_id character varying NOT NULL
);


ALTER TABLE public.contacts OWNER TO postgres;

--
-- Name: contract_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contract_templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name text NOT NULL,
    display_title text,
    body_html text,
    form_fields text,
    signature_workflow text DEFAULT 'counter_sign_after_client'::text,
    is_default boolean DEFAULT false,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.contract_templates OWNER TO postgres;

--
-- Name: contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contracts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    contract_number text NOT NULL,
    contact_id character varying NOT NULL,
    project_id character varying,
    quote_id character varying,
    title text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    signed_at timestamp without time zone,
    expires_at timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id character varying,
    business_signature text,
    client_signature text,
    business_signed_at timestamp without time zone,
    client_signed_at timestamp without time zone,
    signature_workflow text DEFAULT 'counter_sign_after_client'::text,
    tenant_id character varying NOT NULL,
    display_title text,
    body_html text,
    due_date timestamp without time zone,
    form_fields text,
    form_responses text,
    sent_at timestamp without time zone,
    template_id character varying
);


ALTER TABLE public.contracts OWNER TO postgres;

--
-- Name: COLUMN contracts.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.contracts.status IS 'Status values: draft, sent, awaiting_counter_signature, signed, cancelled';


--
-- Name: document_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_views (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    document_type text NOT NULL,
    document_id character varying NOT NULL,
    viewed_at timestamp without time zone DEFAULT now(),
    ip_address text,
    user_agent text
);


ALTER TABLE public.document_views OWNER TO postgres;

--
-- Name: email_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_accounts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    user_id character varying NOT NULL,
    provider_key text NOT NULL,
    status text DEFAULT 'connected'::text NOT NULL,
    account_email text,
    expires_at timestamp with time zone,
    metadata text,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    auth_type text NOT NULL,
    secrets_enc text
);


ALTER TABLE public.email_accounts OWNER TO postgres;

--
-- Name: email_action_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_action_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    email_id character varying NOT NULL,
    thread_id character varying,
    action_text text NOT NULL,
    due_date timestamp without time zone,
    priority text,
    status text DEFAULT 'pending'::text,
    model text NOT NULL,
    tokens_used integer,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone
);


ALTER TABLE public.email_action_items OWNER TO postgres;

--
-- Name: email_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_attachments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email_id character varying,
    filename character varying,
    mime_type character varying,
    size integer,
    storage_key character varying,
    created_at timestamp without time zone DEFAULT now(),
    user_id character varying NOT NULL,
    tenant_id character varying NOT NULL
);


ALTER TABLE public.email_attachments OWNER TO postgres;

--
-- Name: email_drafts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_drafts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    thread_id character varying NOT NULL,
    in_reply_to_email_id character varying,
    draft_content text NOT NULL,
    model text NOT NULL,
    tokens_used integer,
    created_by character varying,
    used boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.email_drafts OWNER TO postgres;

--
-- Name: email_provider_catalog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_provider_catalog (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    display_name text NOT NULL,
    imap_host text,
    imap_port integer,
    imap_secure boolean,
    smtp_host text,
    smtp_port integer,
    smtp_secure boolean,
    help_blurb text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    category text NOT NULL,
    incoming boolean DEFAULT true NOT NULL,
    outgoing boolean DEFAULT true NOT NULL,
    oauth_scopes text,
    imap_auth text,
    smtp_auth text
);


ALTER TABLE public.email_provider_catalog OWNER TO postgres;

--
-- Name: email_provider_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_provider_configs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    user_id character varying,
    name text NOT NULL,
    provider_code text NOT NULL,
    is_active boolean DEFAULT true,
    is_primary boolean DEFAULT false,
    auth_config text NOT NULL,
    from_email text,
    from_name text,
    reply_to_email text,
    capabilities text,
    is_verified boolean DEFAULT false,
    last_verified_at timestamp without time zone,
    verification_error text,
    last_used_at timestamp without time zone,
    messages_sent integer DEFAULT 0,
    messages_received integer DEFAULT 0,
    is_healthy boolean DEFAULT true,
    last_health_check_at timestamp without time zone,
    consecutive_failures integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.email_provider_configs OWNER TO postgres;

--
-- Name: email_signatures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_signatures (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    content text NOT NULL,
    is_default boolean DEFAULT false,
    user_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    tenant_id character varying NOT NULL
);


ALTER TABLE public.email_signatures OWNER TO postgres;

--
-- Name: email_summaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_summaries (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    thread_id character varying NOT NULL,
    summary text NOT NULL,
    model text NOT NULL,
    tokens_used integer,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.email_summaries OWNER TO postgres;

--
-- Name: email_thread_reads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_thread_reads (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    thread_id character varying NOT NULL,
    last_read_at timestamp without time zone DEFAULT now(),
    user_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.email_thread_reads OWNER TO postgres;

--
-- Name: email_threads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_threads (
    id character varying NOT NULL,
    project_id character varying,
    subject text,
    last_message_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id character varying,
    tenant_id character varying NOT NULL
);


ALTER TABLE public.email_threads OWNER TO postgres;

--
-- Name: emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emails (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    subject text NOT NULL,
    body text,
    from_email text NOT NULL,
    to_emails text[] NOT NULL,
    cc_emails text[],
    bcc_emails text[],
    status text DEFAULT 'draft'::text NOT NULL,
    thread_id character varying,
    lead_id character varying,
    contact_id character varying,
    project_id character varying,
    sent_by character varying,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    provider character varying DEFAULT 'gmail'::character varying,
    provider_message_id character varying,
    provider_thread_id character varying,
    message_id character varying,
    in_reply_to character varying,
    "references" character varying,
    direction character varying,
    snippet text,
    body_text text,
    body_html text,
    has_attachments boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now(),
    user_id character varying,
    tenant_id character varying NOT NULL
);


ALTER TABLE public.emails OWNER TO postgres;

--
-- Name: emails_quarantine; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emails_quarantine (
    id character varying NOT NULL,
    tenant_id character varying,
    user_id character varying,
    thread_id character varying,
    provider text,
    provider_message_id text,
    direction text,
    from_email text NOT NULL,
    to_emails text[],
    subject text,
    body_text text,
    sent_at timestamp without time zone,
    quarantined_at timestamp without time zone DEFAULT now(),
    quarantine_reason text DEFAULT 'no_contact_match'::text
);


ALTER TABLE public.emails_quarantine OWNER TO postgres;

--
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    location text,
    start_date timestamp without time zone NOT NULL,
    end_date timestamp without time zone NOT NULL,
    all_day boolean DEFAULT false,
    recurring boolean DEFAULT false,
    recurrence_rule text,
    lead_id character varying,
    contact_id character varying,
    project_id character varying,
    assigned_to character varying,
    created_by character varying NOT NULL,
    external_event_id text,
    provider_data text,
    calendar_integration_id character varying,
    reminder_minutes integer DEFAULT 15,
    attendees text[],
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL,
    is_orphaned boolean DEFAULT false,
    external_calendar_id text,
    source text DEFAULT 'crm'::text NOT NULL,
    sync_state text DEFAULT 'active'::text NOT NULL,
    is_readonly boolean DEFAULT false,
    last_synced_at timestamp without time zone,
    calendar_id character varying,
    timezone text DEFAULT 'UTC'::text,
    history text,
    is_cancelled boolean DEFAULT false,
    cancelled_at timestamp without time zone,
    transparency text DEFAULT 'busy'::text,
    status text DEFAULT 'confirmed'::text NOT NULL,
    CONSTRAINT events_tenant_not_null CHECK ((tenant_id IS NOT NULL))
);


ALTER TABLE public.events OWNER TO postgres;

--
-- Name: COLUMN events.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.events.status IS 'confirmed, cancelled, tentative - event status for Google Calendar sync';


--
-- Name: form_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.form_submissions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    form_id character varying NOT NULL,
    submission_key text NOT NULL,
    ip_address text,
    user_agent text,
    lead_id character varying,
    status text DEFAULT 'processed'::text NOT NULL,
    metadata text,
    submitted_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone NOT NULL
);


ALTER TABLE public.form_submissions OWNER TO postgres;

--
-- Name: income_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.income_categories (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name text NOT NULL,
    is_system boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.income_categories OWNER TO postgres;

--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    internal_name text NOT NULL,
    display_name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    is_taxable boolean DEFAULT true,
    income_category_id character varying,
    workflow_id character varying,
    photo_url text,
    is_active boolean DEFAULT true,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.invoice_items OWNER TO postgres;

--
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_line_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    invoice_id character varying NOT NULL,
    invoice_item_id character varying,
    description text NOT NULL,
    quantity numeric(10,2) DEFAULT '1'::numeric NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    is_taxable boolean DEFAULT true,
    line_total numeric(10,2) NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.invoice_line_items OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    contact_id character varying NOT NULL,
    project_id character varying,
    contract_id character varying,
    title text NOT NULL,
    description text,
    subtotal numeric(10,2) NOT NULL,
    tax_amount numeric(10,2) DEFAULT '0'::numeric,
    total numeric(10,2) NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    due_date timestamp without time zone,
    sent_at timestamp without time zone,
    paid_at timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id character varying,
    tenant_id character varying NOT NULL,
    display_name text,
    po_number text,
    notes text,
    currency text DEFAULT 'GBP'::text,
    discount numeric(10,2) DEFAULT '0'::numeric,
    discount_type text DEFAULT 'percent'::text,
    amount_paid numeric(10,2) DEFAULT '0'::numeric,
    online_payments_enabled boolean DEFAULT true,
    partial_payments_disabled boolean DEFAULT false,
    has_payment_schedule boolean DEFAULT false,
    is_recurring boolean DEFAULT false,
    stripe_payment_intent_id text,
    stripe_customer_id text
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: job_executions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_executions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    job_id character varying NOT NULL,
    status text NOT NULL,
    started_at timestamp without time zone DEFAULT now(),
    completed_at timestamp without time zone,
    error text,
    result text,
    attempt integer DEFAULT 1 NOT NULL,
    tenant_id character varying NOT NULL
);


ALTER TABLE public.job_executions OWNER TO postgres;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.jobs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    payload text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    delay integer,
    schedule text,
    status text DEFAULT 'pending'::text NOT NULL,
    next_run_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.jobs OWNER TO postgres;

--
-- Name: lead_automation_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_automation_rules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    from_status text,
    to_status text NOT NULL,
    trigger_type text NOT NULL,
    trigger_config text NOT NULL,
    if_conflict_block boolean DEFAULT false NOT NULL,
    require_no_manual_since_minutes integer,
    action_email_template_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.lead_automation_rules OWNER TO postgres;

--
-- Name: lead_capture_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_capture_forms (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    notification text DEFAULT 'email'::text NOT NULL,
    calendar_id character varying,
    lifecycle_id character varying,
    workflow_id character varying,
    contact_tags text,
    project_tags text,
    recaptcha_enabled boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    questions text,
    tenant_id character varying NOT NULL,
    consent_text text DEFAULT 'I consent to processing my personal data for contact purposes.'::text,
    consent_required boolean DEFAULT true,
    data_retention_days integer DEFAULT 365,
    privacy_policy_url text,
    from_address text,
    auto_responder_template_id character varying,
    auto_responder_delay_seconds integer,
    booking_link text
);


ALTER TABLE public.lead_capture_forms OWNER TO postgres;

--
-- Name: lead_consents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_consents (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    lead_id character varying NOT NULL,
    form_id character varying,
    consent_type text DEFAULT 'marketing'::text NOT NULL,
    consent_given boolean NOT NULL,
    consent_text text,
    granted_at timestamp without time zone DEFAULT now(),
    revoked_at timestamp without time zone,
    ip_address text,
    user_agent text
);


ALTER TABLE public.lead_consents OWNER TO postgres;

--
-- Name: lead_custom_field_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_custom_field_responses (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying,
    lead_id character varying NOT NULL,
    field_key text NOT NULL,
    value text,
    file_name text,
    file_size integer,
    mime_type text,
    submitted_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lead_custom_field_responses OWNER TO postgres;

--
-- Name: lead_custom_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_custom_fields (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying,
    user_id character varying,
    key text NOT NULL,
    label text NOT NULL,
    type text NOT NULL,
    help_text text,
    placeholder text,
    options text[],
    is_required boolean DEFAULT false,
    is_standard boolean DEFAULT false,
    crm_mapping text,
    validation_rules text,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lead_custom_fields OWNER TO postgres;

--
-- Name: lead_follow_up_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_follow_up_notifications (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    user_id character varying NOT NULL,
    lead_id character varying NOT NULL,
    notification_type text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    message text NOT NULL,
    urgency_score integer,
    read boolean DEFAULT false,
    read_at timestamp without time zone,
    dismissed boolean DEFAULT false,
    dismissed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lead_follow_up_notifications OWNER TO postgres;

--
-- Name: lead_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_status_history (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    lead_id character varying,
    from_status text,
    to_status text NOT NULL,
    reason text NOT NULL,
    metadata text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.lead_status_history OWNER TO postgres;

--
-- Name: leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leads (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    company text,
    lead_source text,
    estimated_value numeric(10,2),
    status text DEFAULT 'new'::text NOT NULL,
    notes text,
    assigned_to character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    last_contact_at timestamp without time zone,
    last_manual_status_at timestamp without time zone,
    project_date timestamp without time zone,
    last_viewed_at timestamp without time zone,
    project_id character varying,
    full_name text,
    middle_name text,
    user_id character varying,
    tenant_id character varying NOT NULL,
    event_type text,
    event_location text
);


ALTER TABLE public.leads OWNER TO postgres;

--
-- Name: mail_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mail_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    provider character varying,
    imap_host character varying,
    imap_port integer,
    imap_username character varying,
    imap_password character varying,
    imap_security character varying,
    smtp_host character varying,
    smtp_port integer,
    smtp_username character varying,
    smtp_password character varying,
    smtp_security character varying,
    from_name character varying,
    from_email character varying,
    reply_to_email character varying,
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    sync_interval_minutes integer DEFAULT 5,
    last_tested_at timestamp without time zone,
    last_test_result character varying,
    last_test_error text,
    quota_used integer DEFAULT 0,
    quota_limit integer DEFAULT 1000,
    quota_reset_at timestamp without time zone,
    consecutive_failures integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.mail_settings OWNER TO postgres;

--
-- Name: mail_settings_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mail_settings_audit (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    settings_id character varying NOT NULL,
    kind character varying NOT NULL,
    ok boolean NOT NULL,
    error text,
    duration_ms integer DEFAULT 0,
    meta text,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.mail_settings_audit OWNER TO postgres;

--
-- Name: media_library; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.media_library (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    file_name text NOT NULL,
    file_type text NOT NULL,
    mime_type text NOT NULL,
    file_size integer NOT NULL,
    file_path text NOT NULL,
    thumbnail_path text,
    title text,
    description text,
    category text,
    tags text[],
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    uploaded_by character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.media_library OWNER TO postgres;

--
-- Name: member_availability; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.member_availability (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    member_id character varying NOT NULL,
    date timestamp without time zone NOT NULL,
    available boolean DEFAULT true,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.member_availability OWNER TO postgres;

--
-- Name: members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.members (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text,
    instruments text[],
    hourly_rate numeric(10,2),
    address text,
    city text,
    state text,
    zip_code text,
    preferred_status boolean DEFAULT false,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id character varying,
    tenant_id character varying NOT NULL
);


ALTER TABLE public.members OWNER TO postgres;

--
-- Name: message_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    subject text,
    body text NOT NULL,
    variables text[],
    category text,
    is_active boolean DEFAULT true,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.message_templates OWNER TO postgres;

--
-- Name: message_threads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.message_threads (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    subject text,
    participants text[] NOT NULL,
    lead_id character varying,
    contact_id character varying,
    project_id character varying,
    last_message_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.message_threads OWNER TO postgres;

--
-- Name: notification_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    user_id character varying,
    email_notifications_enabled boolean DEFAULT true,
    email_frequency text DEFAULT 'daily'::text,
    in_app_notifications_enabled boolean DEFAULT true,
    auto_reply_enabled boolean DEFAULT false,
    auto_reply_message text,
    follow_up_threshold_hours integer DEFAULT 24,
    event_date_urgency_days integer DEFAULT 30,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    days_without_reply integer DEFAULT 3,
    days_since_inquiry integer DEFAULT 7
);


ALTER TABLE public.notification_settings OWNER TO postgres;

--
-- Name: payment_installments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_installments (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    payment_schedule_id character varying NOT NULL,
    installment_number integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    amount_type text NOT NULL,
    due_date timestamp without time zone,
    due_date_trigger text,
    due_date_offset integer,
    due_date_offset_unit text,
    status text DEFAULT 'pending'::text,
    paid_at timestamp without time zone,
    paid_amount numeric(10,2) DEFAULT '0'::numeric,
    stripe_payment_intent_id text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.payment_installments OWNER TO postgres;

--
-- Name: payment_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_schedules (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    invoice_id character varying NOT NULL,
    schedule_type text NOT NULL,
    number_of_payments integer,
    start_date timestamp without time zone,
    frequency text,
    frequency_interval integer,
    custom_message text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.payment_schedules OWNER TO postgres;

--
-- Name: payment_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_sessions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    invoice_id character varying NOT NULL,
    contact_id character varying NOT NULL,
    provider text NOT NULL,
    session_id text,
    amount integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone,
    success_url text,
    cancel_url text,
    metadata text,
    payment_intent_id text,
    tenant_id character varying NOT NULL
);


ALTER TABLE public.payment_sessions OWNER TO postgres;

--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_transactions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    invoice_id character varying NOT NULL,
    installment_id character varying,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'GBP'::text,
    payment_method text NOT NULL,
    stripe_payment_intent_id text,
    stripe_charge_id text,
    status text NOT NULL,
    failure_reason text,
    paid_at timestamp without time zone,
    refunded_at timestamp without time zone,
    refund_amount numeric(10,2),
    metadata text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.payment_transactions OWNER TO postgres;

--
-- Name: portal_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.portal_forms (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    contact_id character varying NOT NULL,
    title text NOT NULL,
    description text,
    form_definition text NOT NULL,
    status text DEFAULT 'not_started'::text NOT NULL,
    draft_data text,
    submitted_data text,
    submitted_at timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.portal_forms OWNER TO postgres;

--
-- Name: project_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_files (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    file_name text NOT NULL,
    original_name text NOT NULL,
    file_size integer,
    mime_type text,
    uploaded_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.project_files OWNER TO postgres;

--
-- Name: project_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_members (
    project_id character varying NOT NULL,
    member_id character varying NOT NULL,
    role text,
    fee numeric(10,2),
    status text DEFAULT 'pending'::text NOT NULL,
    confirmed_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.project_members OWNER TO postgres;

--
-- Name: project_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_notes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    project_id character varying NOT NULL,
    note text NOT NULL,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.project_notes OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    contact_id character varying NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    progress integer DEFAULT 0,
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    estimated_value numeric(10,2),
    actual_value numeric(10,2),
    assigned_to character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    venue_id character varying,
    portal_enabled_override boolean,
    user_id character varying,
    tenant_id character varying NOT NULL,
    primary_event_id character varying
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: quote_addons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_addons (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    vat_rate numeric(5,4) DEFAULT 0.20,
    category text,
    depends_on_package boolean DEFAULT false,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.quote_addons OWNER TO postgres;

--
-- Name: quote_extra_info_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_extra_info_config (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    quote_id character varying NOT NULL,
    is_enabled boolean DEFAULT false,
    enabled_fields text[] DEFAULT '{}'::text[] NOT NULL,
    field_required_overrides text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.quote_extra_info_config OWNER TO postgres;

--
-- Name: quote_extra_info_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_extra_info_fields (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying,
    key text NOT NULL,
    label text NOT NULL,
    type text NOT NULL,
    help_text text,
    placeholder text,
    options text[],
    is_required boolean DEFAULT false,
    is_standard boolean DEFAULT false,
    crm_mapping text,
    validation_rules text,
    display_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.quote_extra_info_fields OWNER TO postgres;

--
-- Name: quote_extra_info_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_extra_info_responses (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    quote_id character varying NOT NULL,
    field_key text NOT NULL,
    value text,
    file_name text,
    file_size integer,
    mime_type text,
    submitted_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.quote_extra_info_responses OWNER TO postgres;

--
-- Name: quote_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    quote_id character varying NOT NULL,
    type text NOT NULL,
    package_id character varying,
    addon_id character varying,
    name text NOT NULL,
    description text,
    quantity integer DEFAULT 1,
    unit_price numeric(10,2) NOT NULL,
    vat_rate numeric(5,4) NOT NULL,
    line_total numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.quote_items OWNER TO postgres;

--
-- Name: quote_packages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_packages (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    base_price numeric(10,2) NOT NULL,
    vat_rate numeric(5,4) DEFAULT 0.20,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.quote_packages OWNER TO postgres;

--
-- Name: quote_signatures; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_signatures (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    quote_id character varying NOT NULL,
    signer_name text NOT NULL,
    signer_email text,
    agreement_accepted boolean DEFAULT false,
    signed_at timestamp without time zone DEFAULT now(),
    ip_address text,
    user_agent text
);


ALTER TABLE public.quote_signatures OWNER TO postgres;

--
-- Name: quote_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quote_tokens (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    quote_id character varying NOT NULL,
    token text NOT NULL,
    is_active boolean DEFAULT true,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.quote_tokens OWNER TO postgres;

--
-- Name: quotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    quote_number text NOT NULL,
    contact_id character varying,
    lead_id character varying,
    title text NOT NULL,
    description text,
    subtotal numeric(10,2) NOT NULL,
    tax_amount numeric(10,2) DEFAULT '0'::numeric,
    total numeric(10,2) NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    valid_until timestamp without time zone,
    sent_at timestamp without time zone,
    approved_at timestamp without time zone,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id character varying,
    vat_mode text DEFAULT 'exclusive'::text,
    contract_text text,
    requires_signature boolean DEFAULT true,
    accepted_at timestamp without time zone,
    invoice_generated boolean DEFAULT false,
    event_date timestamp without time zone,
    venue text,
    currency text DEFAULT 'GBP'::text,
    tenant_id character varying NOT NULL
);


ALTER TABLE public.quotes OWNER TO postgres;

--
-- Name: recurring_invoice_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recurring_invoice_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    invoice_id character varying NOT NULL,
    frequency text NOT NULL,
    frequency_interval integer NOT NULL,
    email_template_id text,
    end_date timestamp without time zone,
    end_after_occurrences integer,
    next_send_date timestamp without time zone,
    occurrence_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.recurring_invoice_settings OWNER TO postgres;

--
-- Name: schedule_calendar_checks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedule_calendar_checks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    schedule_id character varying NOT NULL,
    calendar_integration_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.schedule_calendar_checks OWNER TO postgres;

--
-- Name: schedule_services; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedule_services (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    schedule_id character varying NOT NULL,
    service_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.schedule_services OWNER TO postgres;

--
-- Name: schedule_team_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedule_team_members (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    schedule_id character varying NOT NULL,
    member_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.schedule_team_members OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: sms_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_messages (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    body text NOT NULL,
    from_phone text NOT NULL,
    to_phone text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    direction text NOT NULL,
    twilio_sid text,
    thread_id character varying,
    lead_id character varying,
    contact_id character varying,
    project_id character varying,
    sent_by character varying,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.sms_messages OWNER TO postgres;

--
-- Name: tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tags (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#3b82f6'::text NOT NULL,
    category text,
    usage_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tags OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    priority text DEFAULT 'medium'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    due_date timestamp without time zone,
    completed_at timestamp without time zone,
    assigned_to character varying,
    lead_id character varying,
    contact_id character varying,
    project_id character varying,
    created_by character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    user_id character varying,
    tenant_id character varying NOT NULL
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: tax_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tax_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    tax_name text DEFAULT 'VAT'::text NOT NULL,
    tax_rate numeric(5,2) DEFAULT 20.00 NOT NULL,
    is_enabled boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tax_settings OWNER TO postgres;

--
-- Name: templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.templates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    subject text,
    body text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.templates OWNER TO postgres;

--
-- Name: tenant_email_prefs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_email_prefs (
    tenant_id character varying NOT NULL,
    bcc_self boolean DEFAULT false,
    read_receipts boolean DEFAULT false,
    show_on_dashboard boolean DEFAULT true,
    contacts_only boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tenant_email_prefs OWNER TO postgres;

--
-- Name: tenant_onboarding_progress; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_onboarding_progress (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    is_completed boolean DEFAULT false,
    is_skipped boolean DEFAULT false,
    current_step text,
    completed_at timestamp without time zone,
    skipped_at timestamp without time zone,
    last_interaction_at timestamp without time zone DEFAULT now(),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    completed_steps text[] DEFAULT ARRAY[]::text[],
    skipped_steps text[] DEFAULT ARRAY[]::text[],
    pending_oauth_provider text,
    collected_data text
);


ALTER TABLE public.tenant_onboarding_progress OWNER TO postgres;

--
-- Name: tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenants (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    domain text,
    is_active boolean DEFAULT true,
    plan text DEFAULT 'starter'::text,
    settings text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tenants OWNER TO postgres;

--
-- Name: user_prefs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_prefs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.user_prefs OWNER TO postgres;

--
-- Name: user_style_samples; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_style_samples (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    user_id character varying NOT NULL,
    sample_text text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_style_samples OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    email text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    avatar text,
    role text DEFAULT 'client'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    tenant_id character varying NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: venues; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.venues (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text,
    city text,
    state text,
    zip_code text,
    capacity integer,
    contact_name text,
    contact_phone text,
    contact_email text,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    country text,
    address2 text,
    country_code text,
    latitude numeric(10,8),
    longitude numeric(11,8),
    place_id text,
    website text,
    restrictions text,
    access_notes text,
    manager_name text,
    manager_phone text,
    manager_email text,
    preferred boolean DEFAULT false,
    use_count integer DEFAULT 0,
    last_used_at timestamp without time zone,
    tags text[],
    meta text,
    user_id character varying,
    tenant_id character varying(255) NOT NULL,
    normalized_name text,
    normalized_address text
);


ALTER TABLE public.venues OWNER TO postgres;

--
-- Name: widget_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.widget_settings (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    tenant_id character varying NOT NULL,
    is_enabled boolean DEFAULT true,
    welcome_message text DEFAULT 'Hi! How can I help you today?'::text,
    brand_color text DEFAULT '#3b82f6'::text,
    "position" text DEFAULT 'bottom-right'::text,
    chatbot_name text DEFAULT 'Assistant'::text,
    avatar_url text,
    tone text DEFAULT 'professional'::text,
    booking_prompt_aggressiveness text DEFAULT 'gentle'::text,
    collect_email_before boolean DEFAULT false,
    enable_sound_notifications boolean DEFAULT true,
    enable_typing_indicator boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.widget_settings OWNER TO postgres;

--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: postgres
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
\.


--
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activities (id, type, description, entity_type, entity_id, user_id, created_at, tenant_id, contact_id) FROM stdin;
\.


--
-- Data for Name: admin_audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admin_audit_logs (id, admin_user_id, impersonated_user_id, tenant_id, action, details, ip_address, user_agent, session_id, created_at) FROM stdin;
\.


--
-- Data for Name: ai_business_context; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_business_context (id, tenant_id, business_name, business_type, industry, services, pricing_info, business_hours, target_audience, brand_voice, terminology, standard_responses, policies, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: ai_custom_instructions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_custom_instructions (id, tenant_id, instruction, category, is_active, priority, created_at) FROM stdin;
\.


--
-- Data for Name: ai_knowledge_base; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_knowledge_base (id, tenant_id, title, category, content, tags, is_active, priority, created_by, updated_at, created_at) FROM stdin;
\.


--
-- Data for Name: ai_training_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_training_documents (id, tenant_id, file_name, file_type, file_size, file_path, extracted_text, category, is_processed, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, metadata, ip_address, user_agent, "timestamp") FROM stdin;
\.


--
-- Data for Name: auto_reply_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auto_reply_log (id, tenant_id, lead_id, email_id, message, sent_at) FROM stdin;
\.


--
-- Data for Name: auto_responder_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auto_responder_logs (id, tenant_id, lead_id, template_id, form_id, provider, status, error_code, error_message, provider_message_id, retry_count, scheduled_for, sent_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: automations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.automations (id, name, description, trigger, actions, is_active, created_by, created_at, updated_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: availability_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.availability_rules (id, schedule_id, frequency, selected_days, date_start, date_end, time_start, time_end, is_exception, created_at) FROM stdin;
\.


--
-- Data for Name: availability_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.availability_schedules (id, tenant_id, name, public_link, is_active, created_at, updated_at, min_advance_notice_hours, max_future_days, daily_booking_limit, weekly_booking_limit, cancellation_policy_hours, header_image_url) FROM stdin;
\.


--
-- Data for Name: bookable_services; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bookable_services (id, tenant_id, name, description, service_type, duration, buffer_before, buffer_after, start_time_interval, service_questions, project_questions, require_phone, enable_online_payments, payment_amount, payment_type, location, location_details, confirmation_message_template_id, cancellation_message_template_id, reminder_message_template_id, reminder_days_before, auto_create_project, add_contact_tags, add_project_tags, remove_project_tags, update_project_date_to_booking, require_approval, approval_calendar_id, approval_workflow_id, approval_auto_email, is_active, display_order, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bookings (id, tenant_id, service_id, schedule_id, contact_id, lead_id, project_id, booked_by, booked_email, booked_phone, start_time, end_time, timezone, service_responses, project_responses, status, approval_status, google_event_id, confirmation_sent_at, reminder_sent_at, cancellation_sent_at, cancelled_at, cancelled_by, cancellation_reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: calendar_integrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.calendar_integrations (id, user_id, provider, provider_account_id, calendar_id, calendar_name, access_token, refresh_token, sync_token, webhook_id, is_active, sync_direction, last_sync_at, sync_errors, settings, created_at, updated_at, tenant_id, service_type, connected_at, disconnected_at, disconnect_reason) FROM stdin;
\.


--
-- Data for Name: calendar_sync_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.calendar_sync_log (id, integration_id, sync_type, direction, events_processed, events_created, events_updated, events_deleted, errors, started_at, completed_at, status) FROM stdin;
\.


--
-- Data for Name: calendars; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.calendars (id, tenant_id, name, color, type, is_system, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: chat_conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_conversations (id, tenant_id, visitor_email, visitor_name, contact_id, lead_id, session_id, ip_address, user_agent, is_converted, conversion_type, lead_quality_score, last_message_at, created_at) FROM stdin;
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.chat_messages (id, tenant_id, conversation_id, role, content, media_urls, function_called, function_result, tokens_used, created_at) FROM stdin;
\.


--
-- Data for Name: contact_field_definitions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact_field_definitions (id, tenant_id, name, label, field_type, options, required, display_order, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: contact_field_values; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contact_field_values (id, tenant_id, contact_id, field_definition_id, value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contacts (id, first_name, last_name, email, phone, company, address, city, state, zip_code, country, lead_id, created_at, updated_at, job_title, website, tags, lead_source, notes, venue_address, venue_city, venue_state, venue_zip_code, venue_country, venue_id, full_name, middle_name, user_id, tenant_id) FROM stdin;
\.


--
-- Data for Name: contract_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contract_templates (id, tenant_id, name, display_title, body_html, form_fields, signature_workflow, is_default, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contracts (id, contract_number, contact_id, project_id, quote_id, title, status, signed_at, expires_at, created_by, created_at, updated_at, user_id, business_signature, client_signature, business_signed_at, client_signed_at, signature_workflow, tenant_id, display_title, body_html, due_date, form_fields, form_responses, sent_at, template_id) FROM stdin;
\.


--
-- Data for Name: document_views; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_views (id, tenant_id, document_type, document_id, viewed_at, ip_address, user_agent) FROM stdin;
\.


--
-- Data for Name: email_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_accounts (id, tenant_id, user_id, provider_key, status, account_email, expires_at, metadata, last_synced_at, created_at, updated_at, auth_type, secrets_enc) FROM stdin;
\.


--
-- Data for Name: email_action_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_action_items (id, tenant_id, email_id, thread_id, action_text, due_date, priority, status, model, tokens_used, created_by, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: email_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_attachments (id, email_id, filename, mime_type, size, storage_key, created_at, user_id, tenant_id) FROM stdin;
\.


--
-- Data for Name: email_drafts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_drafts (id, tenant_id, thread_id, in_reply_to_email_id, draft_content, model, tokens_used, created_by, used, created_at) FROM stdin;
\.


--
-- Data for Name: email_provider_catalog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_provider_catalog (id, key, display_name, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, help_blurb, is_active, created_at, updated_at, category, incoming, outgoing, oauth_scopes, imap_auth, smtp_auth) FROM stdin;
c96c53ea-4ebb-4c6c-86e2-f57ce01a20b4	icloud	Apple iCloud	imap.mail.me.com	993	t	smtp.mail.me.com	587	t	Requires app-specific password from appleid.apple.com. Go to Account Settings > Security > App-Specific Passwords.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
497bbeaa-2e15-4740-8b4c-1a0f889c3b36	yahoo	Yahoo Mail	imap.mail.yahoo.com	993	t	smtp.mail.yahoo.com	587	t	Enable app passwords in your Yahoo account security settings. Use the app password instead of your regular password.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
ea4b1253-a75c-4b60-a78e-1c848873e4ff	aol	AOL Mail	imap.aol.com	993	t	smtp.aol.com	587	t	Use app password for security. Legacy accounts may need special configuration. Check AOL Help for details.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
833d8e53-7a20-47f0-b066-d2dbcf6a77cb	outlook	Outlook.com / Hotmail / Live	outlook.office365.com	993	t	smtp.office365.com	587	t	Prefer Microsoft sign-in where available. For IMAP/SMTP, use modern authentication. May require app password.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
8fd3a0ed-db3a-45f4-bc70-4a5aa5d32e73	zoho	Zoho Mail	imap.zoho.com	993	t	smtp.zoho.com	587	t	Enable IMAP in Zoho Mail settings under Mail Accounts > IMAP Access. Consider using app-specific passwords.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
fdd724ed-6c48-4021-b740-b2d757c69abd	fastmail	Fastmail	imap.fastmail.com	993	t	smtp.fastmail.com	587	t	Use app passwords for third-party access. Generate them in Settings > Password & Security > App Passwords.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
d49852d6-d048-40ca-9e40-4e1b940eecac	protonmail	ProtonMail	127.0.0.1	1143	f	127.0.0.1	1025	f	Requires ProtonMail Bridge app running locally. Bridge provides IMAP/SMTP access to encrypted ProtonMail.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
d89929af-fd5f-4df2-85fe-d7b4418adf7a	godaddy_workspace	GoDaddy Workspace Email	imap.secureserver.net	993	t	smtpout.secureserver.net	587	t	Use your full email address as username. Hosts may vary based on your DNS setup—these are the defaults.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
85664929-daaa-4ba6-8da1-d8b497065edb	google	Google Gmail	\N	\N	\N	\N	\N	\N	Sign in with Google. No app password needed. Gmail uses OAuth for secure authentication.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	oauth	t	t	\N	\N	\N
d0fcf821-8791-44f1-8293-467d94df3fc8	microsoft	Microsoft Office 365	\N	\N	\N	\N	\N	\N	Sign in with Microsoft. Uses Graph API for email access. No app password required.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	oauth	t	t	\N	\N	\N
8145a027-ccd1-4616-a081-b9f6e94162c1	att	AT&T Email	imap.mail.att.net	993	t	smtp.mail.att.net	465	t	Legacy AT&T email accounts. Secure ports required. May need app password. Check AT&T support for current settings.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
03c21fbe-7bbc-48bf-80ee-f5dfade97506	bellsouth	BellSouth Email	imap.mail.att.net	993	t	smtp.mail.att.net	465	t	BellSouth now uses AT&T servers. Secure ports required. May need app password for third-party access.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
ce512274-7c3b-483f-bd32-7a9d179d9116	sbcglobal	SBC Global Email	imap.mail.att.net	993	t	smtp.mail.att.net	465	t	SBC Global uses AT&T infrastructure. Secure ports required. App password may be necessary.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
6c2df450-d2c0-429f-8d26-9aacf6547389	cox_business	Cox Business Email	imap.cox.net	993	t	smtp.cox.net	587	t	Cox Business email requires your full email as username. Check Cox support for current server settings.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
a423b25b-0065-4a3a-a8a8-40ac875e4688	siteground	SiteGround Email	mail.yourdomain.com	993	t	mail.yourdomain.com	587	t	Use your cPanel email credentials. Replace yourdomain.com with your actual domain. Ports: 993 (IMAP) / 587 or 465 (SMTP).	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
b6905f8d-f805-4a71-9ef5-eea6ac5e694f	bluehost	Bluehost Email	mail.yourdomain.com	993	t	mail.yourdomain.com	587	t	Use mailbox credentials from cPanel. Replace yourdomain.com with your domain. Standard ports: 993/587 or 465.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
7a1b6c5d-22f2-437c-b04d-48359f22b33e	sky	Sky Email	imap.sky.com	993	t	smtp.sky.com	587	t	Sky UK email service. Use full email address and password. Check Sky Help for current server settings.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
505bae0a-3a29-48d4-b1b9-be91cc1949b7	ionos	1&1 IONOS Email	imap.1and1.com	993	t	smtp.1and1.com	587	t	IONOS (formerly 1&1) email. Use full email address as username. Check IONOS help for regional server variations.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
2cebe7c7-17ab-4eac-ba35-84332779714d	other	Custom IMAP/SMTP	\N	993	t	\N	587	t	Enter your own email server settings. Contact your email provider for IMAP/SMTP host, port, and security settings.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
3e2f4a06-dc8e-4eb1-8351-b0f846f56e1e	godaddy_o365	GoDaddy Office 365	outlook.office365.com	993	t	smtp.office365.com	587	t	GoDaddy-hosted Office 365 uses Microsoft servers. Consider using OAuth (Office 365) option instead.	t	2025-09-29 18:15:33.13982	2025-09-29 18:15:33.13982	imap_smtp	t	t	\N	\N	\N
\.


--
-- Data for Name: email_provider_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_provider_configs (id, tenant_id, user_id, name, provider_code, is_active, is_primary, auth_config, from_email, from_name, reply_to_email, capabilities, is_verified, last_verified_at, verification_error, last_used_at, messages_sent, messages_received, is_healthy, last_health_check_at, consecutive_failures, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: email_signatures; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_signatures (id, name, content, is_default, user_id, created_at, updated_at, is_active, tenant_id) FROM stdin;
\.


--
-- Data for Name: email_summaries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_summaries (id, tenant_id, thread_id, summary, model, tokens_used, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: email_thread_reads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_thread_reads (id, thread_id, last_read_at, user_id, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: email_threads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_threads (id, project_id, subject, last_message_at, created_at, updated_at, user_id, tenant_id) FROM stdin;
\.


--
-- Data for Name: emails; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.emails (id, subject, body, from_email, to_emails, cc_emails, bcc_emails, status, thread_id, lead_id, contact_id, project_id, sent_by, sent_at, created_at, provider, provider_message_id, provider_thread_id, message_id, in_reply_to, "references", direction, snippet, body_text, body_html, has_attachments, updated_at, user_id, tenant_id) FROM stdin;
\.


--
-- Data for Name: emails_quarantine; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.emails_quarantine (id, tenant_id, user_id, thread_id, provider, provider_message_id, direction, from_email, to_emails, subject, body_text, sent_at, quarantined_at, quarantine_reason) FROM stdin;
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.events (id, title, description, location, start_date, end_date, all_day, recurring, recurrence_rule, lead_id, contact_id, project_id, assigned_to, created_by, external_event_id, provider_data, calendar_integration_id, reminder_minutes, attendees, created_at, updated_at, tenant_id, is_orphaned, external_calendar_id, source, sync_state, is_readonly, last_synced_at, calendar_id, timezone, history, is_cancelled, cancelled_at, transparency, status) FROM stdin;
\.


--
-- Data for Name: form_submissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.form_submissions (id, tenant_id, form_id, submission_key, ip_address, user_agent, lead_id, status, metadata, submitted_at, expires_at) FROM stdin;
\.


--
-- Data for Name: income_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.income_categories (id, tenant_id, name, is_system, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_items (id, tenant_id, internal_name, display_name, description, price, is_taxable, income_category_id, workflow_id, photo_url, is_active, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invoice_line_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_line_items (id, tenant_id, invoice_id, invoice_item_id, description, quantity, unit_price, is_taxable, line_total, display_order, created_at) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, invoice_number, contact_id, project_id, contract_id, title, description, subtotal, tax_amount, total, status, due_date, sent_at, paid_at, created_by, created_at, updated_at, user_id, tenant_id, display_name, po_number, notes, currency, discount, discount_type, amount_paid, online_payments_enabled, partial_payments_disabled, has_payment_schedule, is_recurring, stripe_payment_intent_id, stripe_customer_id) FROM stdin;
\.


--
-- Data for Name: job_executions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.job_executions (id, job_id, status, started_at, completed_at, error, result, attempt, tenant_id) FROM stdin;
\.


--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.jobs (id, type, payload, priority, max_retries, delay, schedule, status, next_run_at, created_at, updated_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: lead_automation_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_automation_rules (id, name, enabled, from_status, to_status, trigger_type, trigger_config, if_conflict_block, require_no_manual_since_minutes, action_email_template_id, created_at, updated_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: lead_capture_forms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_capture_forms (id, name, slug, notification, calendar_id, lifecycle_id, workflow_id, contact_tags, project_tags, recaptcha_enabled, is_active, created_by, created_at, updated_at, questions, tenant_id, consent_text, consent_required, data_retention_days, privacy_policy_url, from_address, auto_responder_template_id, auto_responder_delay_seconds, booking_link) FROM stdin;
\.


--
-- Data for Name: lead_consents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_consents (id, tenant_id, lead_id, form_id, consent_type, consent_given, consent_text, granted_at, revoked_at, ip_address, user_agent) FROM stdin;
\.


--
-- Data for Name: lead_custom_field_responses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_custom_field_responses (id, tenant_id, lead_id, field_key, value, file_name, file_size, mime_type, submitted_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lead_custom_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_custom_fields (id, tenant_id, user_id, key, label, type, help_text, placeholder, options, is_required, is_standard, crm_mapping, validation_rules, display_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lead_follow_up_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_follow_up_notifications (id, tenant_id, user_id, lead_id, notification_type, priority, message, urgency_score, read, read_at, dismissed, dismissed_at, created_at) FROM stdin;
\.


--
-- Data for Name: lead_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lead_status_history (id, lead_id, from_status, to_status, reason, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leads (id, first_name, last_name, email, phone, company, lead_source, estimated_value, status, notes, assigned_to, created_at, updated_at, last_contact_at, last_manual_status_at, project_date, last_viewed_at, project_id, full_name, middle_name, user_id, tenant_id, event_type, event_location) FROM stdin;
\.


--
-- Data for Name: mail_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mail_settings (id, name, provider, imap_host, imap_port, imap_username, imap_password, imap_security, smtp_host, smtp_port, smtp_username, smtp_password, smtp_security, from_name, from_email, reply_to_email, is_active, is_default, sync_interval_minutes, last_tested_at, last_test_result, last_test_error, quota_used, quota_limit, quota_reset_at, consecutive_failures, created_at, updated_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: mail_settings_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.mail_settings_audit (id, settings_id, kind, ok, error, duration_ms, meta, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: media_library; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.media_library (id, tenant_id, file_name, file_type, mime_type, file_size, file_path, thumbnail_path, title, description, category, tags, display_order, is_active, uploaded_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: member_availability; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.member_availability (id, member_id, date, available, notes, created_at) FROM stdin;
\.


--
-- Data for Name: members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.members (id, first_name, last_name, email, phone, instruments, hourly_rate, address, city, state, zip_code, preferred_status, notes, created_at, updated_at, user_id, tenant_id) FROM stdin;
\.


--
-- Data for Name: message_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_templates (id, name, type, subject, body, variables, category, is_active, created_by, created_at, updated_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: message_threads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.message_threads (id, subject, participants, lead_id, contact_id, project_id, last_message_at, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: notification_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_settings (id, tenant_id, user_id, email_notifications_enabled, email_frequency, in_app_notifications_enabled, auto_reply_enabled, auto_reply_message, follow_up_threshold_hours, event_date_urgency_days, created_at, updated_at, days_without_reply, days_since_inquiry) FROM stdin;
\.


--
-- Data for Name: payment_installments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_installments (id, tenant_id, payment_schedule_id, installment_number, amount, amount_type, due_date, due_date_trigger, due_date_offset, due_date_offset_unit, status, paid_at, paid_amount, stripe_payment_intent_id, created_at) FROM stdin;
\.


--
-- Data for Name: payment_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_schedules (id, tenant_id, invoice_id, schedule_type, number_of_payments, start_date, frequency, frequency_interval, custom_message, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_sessions (id, invoice_id, contact_id, provider, session_id, amount, status, created_at, expires_at, success_url, cancel_url, metadata, payment_intent_id, tenant_id) FROM stdin;
\.


--
-- Data for Name: payment_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_transactions (id, tenant_id, invoice_id, installment_id, amount, currency, payment_method, stripe_payment_intent_id, stripe_charge_id, status, failure_reason, paid_at, refunded_at, refund_amount, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: portal_forms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.portal_forms (id, project_id, contact_id, title, description, form_definition, status, draft_data, submitted_data, submitted_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: project_files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_files (id, project_id, file_name, original_name, file_size, mime_type, uploaded_by, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: project_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_members (project_id, member_id, role, fee, status, confirmed_at, notes, created_at) FROM stdin;
\.


--
-- Data for Name: project_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.project_notes (id, project_id, note, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, name, description, contact_id, status, progress, start_date, end_date, estimated_value, actual_value, assigned_to, created_at, updated_at, venue_id, portal_enabled_override, user_id, tenant_id, primary_event_id) FROM stdin;
\.


--
-- Data for Name: quote_addons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_addons (id, name, description, price, vat_rate, category, depends_on_package, is_active, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quote_extra_info_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_extra_info_config (id, quote_id, is_enabled, enabled_fields, field_required_overrides, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quote_extra_info_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_extra_info_fields (id, user_id, key, label, type, help_text, placeholder, options, is_required, is_standard, crm_mapping, validation_rules, display_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quote_extra_info_responses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_extra_info_responses (id, quote_id, field_key, value, file_name, file_size, mime_type, submitted_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quote_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_items (id, quote_id, type, package_id, addon_id, name, description, quantity, unit_price, vat_rate, line_total, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: quote_packages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_packages (id, name, description, base_price, vat_rate, is_active, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quote_signatures; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_signatures (id, quote_id, signer_name, signer_email, agreement_accepted, signed_at, ip_address, user_agent) FROM stdin;
\.


--
-- Data for Name: quote_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quote_tokens (id, quote_id, token, is_active, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quotes (id, quote_number, contact_id, lead_id, title, description, subtotal, tax_amount, total, status, valid_until, sent_at, approved_at, created_by, created_at, updated_at, user_id, vat_mode, contract_text, requires_signature, accepted_at, invoice_generated, event_date, venue, currency, tenant_id) FROM stdin;
\.


--
-- Data for Name: recurring_invoice_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recurring_invoice_settings (id, tenant_id, invoice_id, frequency, frequency_interval, email_template_id, end_date, end_after_occurrences, next_send_date, occurrence_count, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: schedule_calendar_checks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schedule_calendar_checks (id, schedule_id, calendar_integration_id, created_at) FROM stdin;
\.


--
-- Data for Name: schedule_services; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schedule_services (id, schedule_id, service_id, created_at) FROM stdin;
\.


--
-- Data for Name: schedule_team_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schedule_team_members (id, schedule_id, member_id, created_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (sid, sess, expire) FROM stdin;
\.


--
-- Data for Name: sms_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sms_messages (id, body, from_phone, to_phone, status, direction, twilio_sid, thread_id, lead_id, contact_id, project_id, sent_by, sent_at, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tags (id, tenant_id, name, color, category, usage_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, title, description, priority, status, due_date, completed_at, assigned_to, lead_id, contact_id, project_id, created_by, created_at, updated_at, user_id, tenant_id) FROM stdin;
\.


--
-- Data for Name: tax_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tax_settings (id, tenant_id, tax_name, tax_rate, is_enabled, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.templates (id, type, title, subject, body, is_active, created_at, updated_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: tenant_email_prefs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenant_email_prefs (tenant_id, bcc_self, read_receipts, show_on_dashboard, contacts_only, updated_at) FROM stdin;
\.


--
-- Data for Name: tenant_onboarding_progress; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenant_onboarding_progress (id, tenant_id, is_completed, is_skipped, current_step, completed_at, skipped_at, last_interaction_at, created_at, updated_at, completed_steps, skipped_steps, pending_oauth_provider, collected_data) FROM stdin;
\.


--
-- Data for Name: tenants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tenants (id, name, slug, domain, is_active, plan, settings, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_prefs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_prefs (id, user_id, key, value, updated_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: user_style_samples; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_style_samples (id, tenant_id, user_id, sample_text, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password, email, first_name, last_name, avatar, role, created_at, tenant_id) FROM stdin;
\.


--
-- Data for Name: venues; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.venues (id, name, address, city, state, zip_code, capacity, contact_name, contact_phone, contact_email, notes, created_at, updated_at, country, address2, country_code, latitude, longitude, place_id, website, restrictions, access_notes, manager_name, manager_phone, manager_email, preferred, use_count, last_used_at, tags, meta, user_id, tenant_id, normalized_name, normalized_address) FROM stdin;
\.


--
-- Data for Name: widget_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.widget_settings (id, tenant_id, is_enabled, welcome_message, brand_color, "position", chatbot_name, avatar_url, tone, booking_prompt_aggressiveness, collect_email_before, enable_sound_notifications, enable_typing_indicator, created_at, updated_at) FROM stdin;
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: postgres
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 1, false);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: postgres
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: ai_business_context ai_business_context_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_business_context
    ADD CONSTRAINT ai_business_context_pkey PRIMARY KEY (id);


--
-- Name: ai_custom_instructions ai_custom_instructions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_custom_instructions
    ADD CONSTRAINT ai_custom_instructions_pkey PRIMARY KEY (id);


--
-- Name: ai_knowledge_base ai_knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_knowledge_base
    ADD CONSTRAINT ai_knowledge_base_pkey PRIMARY KEY (id);


--
-- Name: ai_training_documents ai_training_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_training_documents
    ADD CONSTRAINT ai_training_documents_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auto_reply_log auto_reply_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_reply_log
    ADD CONSTRAINT auto_reply_log_pkey PRIMARY KEY (id);


--
-- Name: auto_responder_logs auto_responder_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_responder_logs
    ADD CONSTRAINT auto_responder_logs_pkey PRIMARY KEY (id);


--
-- Name: automations automations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_pkey PRIMARY KEY (id);


--
-- Name: availability_rules availability_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability_rules
    ADD CONSTRAINT availability_rules_pkey PRIMARY KEY (id);


--
-- Name: availability_schedules availability_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability_schedules
    ADD CONSTRAINT availability_schedules_pkey PRIMARY KEY (id);


--
-- Name: availability_schedules availability_schedules_public_link_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability_schedules
    ADD CONSTRAINT availability_schedules_public_link_key UNIQUE (public_link);


--
-- Name: bookable_services bookable_services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookable_services
    ADD CONSTRAINT bookable_services_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: calendar_integrations calendar_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_integrations
    ADD CONSTRAINT calendar_integrations_pkey PRIMARY KEY (id);


--
-- Name: calendar_sync_log calendar_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_sync_log
    ADD CONSTRAINT calendar_sync_log_pkey PRIMARY KEY (id);


--
-- Name: calendars calendars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendars
    ADD CONSTRAINT calendars_pkey PRIMARY KEY (id);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: contacts clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: contact_field_definitions contact_field_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_field_definitions
    ADD CONSTRAINT contact_field_definitions_pkey PRIMARY KEY (id);


--
-- Name: contact_field_values contact_field_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_field_values
    ADD CONSTRAINT contact_field_values_pkey PRIMARY KEY (id);


--
-- Name: contract_templates contract_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_templates
    ADD CONSTRAINT contract_templates_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_contract_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_number_unique UNIQUE (contract_number);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: document_views document_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_views
    ADD CONSTRAINT document_views_pkey PRIMARY KEY (id);


--
-- Name: email_action_items email_action_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_action_items
    ADD CONSTRAINT email_action_items_pkey PRIMARY KEY (id);


--
-- Name: email_attachments email_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_attachments
    ADD CONSTRAINT email_attachments_pkey PRIMARY KEY (id);


--
-- Name: email_drafts email_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_drafts
    ADD CONSTRAINT email_drafts_pkey PRIMARY KEY (id);


--
-- Name: email_provider_catalog email_provider_catalog_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_provider_catalog
    ADD CONSTRAINT email_provider_catalog_code_key UNIQUE (key);


--
-- Name: email_provider_catalog email_provider_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_provider_catalog
    ADD CONSTRAINT email_provider_catalog_pkey PRIMARY KEY (id);


--
-- Name: email_provider_configs email_provider_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_provider_configs
    ADD CONSTRAINT email_provider_configs_pkey PRIMARY KEY (id);


--
-- Name: email_accounts email_provider_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_provider_integrations_pkey PRIMARY KEY (id);


--
-- Name: email_accounts email_provider_integrations_tenant_user_provider_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_provider_integrations_tenant_user_provider_unique UNIQUE (tenant_id, user_id, provider_key);


--
-- Name: email_signatures email_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_signatures
    ADD CONSTRAINT email_signatures_pkey PRIMARY KEY (id);


--
-- Name: email_summaries email_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_summaries
    ADD CONSTRAINT email_summaries_pkey PRIMARY KEY (id);


--
-- Name: email_thread_reads email_thread_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_thread_reads
    ADD CONSTRAINT email_thread_reads_pkey PRIMARY KEY (id);


--
-- Name: email_threads email_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_pkey PRIMARY KEY (id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: emails_quarantine emails_quarantine_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails_quarantine
    ADD CONSTRAINT emails_quarantine_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: form_submissions form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_pkey PRIMARY KEY (id);


--
-- Name: form_submissions form_submissions_tenant_submission_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_tenant_submission_key_unique UNIQUE (tenant_id, submission_key);


--
-- Name: income_categories income_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.income_categories
    ADD CONSTRAINT income_categories_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_unique UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: job_executions job_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_executions
    ADD CONSTRAINT job_executions_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: lead_automation_rules lead_automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_automation_rules
    ADD CONSTRAINT lead_automation_rules_pkey PRIMARY KEY (id);


--
-- Name: lead_capture_forms lead_capture_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_capture_forms
    ADD CONSTRAINT lead_capture_forms_pkey PRIMARY KEY (id);


--
-- Name: lead_capture_forms lead_capture_forms_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_capture_forms
    ADD CONSTRAINT lead_capture_forms_slug_key UNIQUE (slug);


--
-- Name: lead_consents lead_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_consents
    ADD CONSTRAINT lead_consents_pkey PRIMARY KEY (id);


--
-- Name: lead_custom_field_responses lead_custom_field_responses_lead_id_field_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_custom_field_responses
    ADD CONSTRAINT lead_custom_field_responses_lead_id_field_key_unique UNIQUE (lead_id, field_key);


--
-- Name: lead_custom_field_responses lead_custom_field_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_custom_field_responses
    ADD CONSTRAINT lead_custom_field_responses_pkey PRIMARY KEY (id);


--
-- Name: lead_custom_fields lead_custom_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_custom_fields
    ADD CONSTRAINT lead_custom_fields_pkey PRIMARY KEY (id);


--
-- Name: lead_custom_fields lead_custom_fields_tenant_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_custom_fields
    ADD CONSTRAINT lead_custom_fields_tenant_key_unique UNIQUE (tenant_id, key);


--
-- Name: lead_follow_up_notifications lead_follow_up_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_up_notifications
    ADD CONSTRAINT lead_follow_up_notifications_pkey PRIMARY KEY (id);


--
-- Name: lead_status_history lead_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_status_history
    ADD CONSTRAINT lead_status_history_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: mail_settings_audit mail_settings_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mail_settings_audit
    ADD CONSTRAINT mail_settings_audit_pkey PRIMARY KEY (id);


--
-- Name: mail_settings mail_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mail_settings
    ADD CONSTRAINT mail_settings_pkey PRIMARY KEY (id);


--
-- Name: media_library media_library_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_library
    ADD CONSTRAINT media_library_pkey PRIMARY KEY (id);


--
-- Name: member_availability member_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_availability
    ADD CONSTRAINT member_availability_pkey PRIMARY KEY (id);


--
-- Name: members members_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_email_unique UNIQUE (email);


--
-- Name: members members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_pkey PRIMARY KEY (id);


--
-- Name: message_templates message_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_pkey PRIMARY KEY (id);


--
-- Name: message_threads message_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_tenant_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_tenant_id_user_id_key UNIQUE (tenant_id, user_id);


--
-- Name: payment_installments payment_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_installments
    ADD CONSTRAINT payment_installments_pkey PRIMARY KEY (id);


--
-- Name: payment_schedules payment_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_schedules
    ADD CONSTRAINT payment_schedules_pkey PRIMARY KEY (id);


--
-- Name: payment_sessions payment_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_sessions
    ADD CONSTRAINT payment_sessions_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: portal_forms portal_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_forms
    ADD CONSTRAINT portal_forms_pkey PRIMARY KEY (id);


--
-- Name: project_files project_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_files
    ADD CONSTRAINT project_files_pkey PRIMARY KEY (id);


--
-- Name: project_notes project_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_notes
    ADD CONSTRAINT project_notes_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: emails provider_message_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT provider_message_id_unique UNIQUE (provider_message_id);


--
-- Name: quote_addons quote_addons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_addons
    ADD CONSTRAINT quote_addons_pkey PRIMARY KEY (id);


--
-- Name: quote_extra_info_config quote_extra_info_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_extra_info_config
    ADD CONSTRAINT quote_extra_info_config_pkey PRIMARY KEY (id);


--
-- Name: quote_extra_info_config quote_extra_info_config_quote_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_extra_info_config
    ADD CONSTRAINT quote_extra_info_config_quote_id_key UNIQUE (quote_id);


--
-- Name: quote_extra_info_fields quote_extra_info_fields_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_extra_info_fields
    ADD CONSTRAINT quote_extra_info_fields_key_unique UNIQUE (key);


--
-- Name: quote_extra_info_fields quote_extra_info_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_extra_info_fields
    ADD CONSTRAINT quote_extra_info_fields_pkey PRIMARY KEY (id);


--
-- Name: quote_extra_info_fields quote_extra_info_fields_user_key_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_extra_info_fields
    ADD CONSTRAINT quote_extra_info_fields_user_key_unique UNIQUE (user_id, key);


--
-- Name: quote_extra_info_responses quote_extra_info_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_extra_info_responses
    ADD CONSTRAINT quote_extra_info_responses_pkey PRIMARY KEY (id);


--
-- Name: quote_extra_info_responses quote_extra_info_responses_quote_id_field_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_extra_info_responses
    ADD CONSTRAINT quote_extra_info_responses_quote_id_field_key_key UNIQUE (quote_id, field_key);


--
-- Name: quote_items quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_pkey PRIMARY KEY (id);


--
-- Name: quote_packages quote_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_packages
    ADD CONSTRAINT quote_packages_pkey PRIMARY KEY (id);


--
-- Name: quote_signatures quote_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_signatures
    ADD CONSTRAINT quote_signatures_pkey PRIMARY KEY (id);


--
-- Name: quote_tokens quote_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_tokens
    ADD CONSTRAINT quote_tokens_pkey PRIMARY KEY (id);


--
-- Name: quote_tokens quote_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_tokens
    ADD CONSTRAINT quote_tokens_token_key UNIQUE (token);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_quote_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_quote_number_unique UNIQUE (quote_number);


--
-- Name: recurring_invoice_settings recurring_invoice_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_invoice_settings
    ADD CONSTRAINT recurring_invoice_settings_pkey PRIMARY KEY (id);


--
-- Name: schedule_calendar_checks schedule_calendar_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_calendar_checks
    ADD CONSTRAINT schedule_calendar_checks_pkey PRIMARY KEY (id);


--
-- Name: schedule_calendar_checks schedule_calendar_checks_schedule_id_calendar_integration_i_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_calendar_checks
    ADD CONSTRAINT schedule_calendar_checks_schedule_id_calendar_integration_i_key UNIQUE (schedule_id, calendar_integration_id);


--
-- Name: schedule_services schedule_services_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_services
    ADD CONSTRAINT schedule_services_pkey PRIMARY KEY (id);


--
-- Name: schedule_services schedule_services_schedule_id_service_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_services
    ADD CONSTRAINT schedule_services_schedule_id_service_id_key UNIQUE (schedule_id, service_id);


--
-- Name: schedule_team_members schedule_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_team_members
    ADD CONSTRAINT schedule_team_members_pkey PRIMARY KEY (id);


--
-- Name: schedule_team_members schedule_team_members_schedule_id_member_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_team_members
    ADD CONSTRAINT schedule_team_members_schedule_id_member_id_key UNIQUE (schedule_id, member_id);


--
-- Name: sessions session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: sms_messages sms_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_pkey PRIMARY KEY (id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: tags tags_tenant_name_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_tenant_name_unique UNIQUE (tenant_id, name);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tax_settings tax_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_settings
    ADD CONSTRAINT tax_settings_pkey PRIMARY KEY (id);


--
-- Name: tax_settings tax_settings_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_settings
    ADD CONSTRAINT tax_settings_tenant_id_key UNIQUE (tenant_id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: tenant_email_prefs tenant_email_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_email_prefs
    ADD CONSTRAINT tenant_email_prefs_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant_onboarding_progress tenant_onboarding_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_onboarding_progress
    ADD CONSTRAINT tenant_onboarding_progress_pkey PRIMARY KEY (id);


--
-- Name: tenant_onboarding_progress tenant_onboarding_progress_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_onboarding_progress
    ADD CONSTRAINT tenant_onboarding_progress_tenant_id_key UNIQUE (tenant_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: user_prefs user_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_prefs
    ADD CONSTRAINT user_prefs_pkey PRIMARY KEY (id);


--
-- Name: user_prefs user_prefs_user_id_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_prefs
    ADD CONSTRAINT user_prefs_user_id_key_key UNIQUE (user_id, key);


--
-- Name: user_style_samples user_style_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_style_samples
    ADD CONSTRAINT user_style_samples_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: venues venues_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_pkey PRIMARY KEY (id);


--
-- Name: widget_settings widget_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.widget_settings
    ADD CONSTRAINT widget_settings_pkey PRIMARY KEY (id);


--
-- Name: widget_settings widget_settings_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.widget_settings
    ADD CONSTRAINT widget_settings_tenant_id_key UNIQUE (tenant_id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: activities_contact_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX activities_contact_id_idx ON public.activities USING btree (contact_id);


--
-- Name: admin_audit_logs_action_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX admin_audit_logs_action_idx ON public.admin_audit_logs USING btree (action);


--
-- Name: admin_audit_logs_admin_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX admin_audit_logs_admin_user_id_idx ON public.admin_audit_logs USING btree (admin_user_id);


--
-- Name: admin_audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX admin_audit_logs_created_at_idx ON public.admin_audit_logs USING btree (created_at);


--
-- Name: admin_audit_logs_impersonated_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX admin_audit_logs_impersonated_user_id_idx ON public.admin_audit_logs USING btree (impersonated_user_id);


--
-- Name: admin_audit_logs_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX admin_audit_logs_tenant_id_idx ON public.admin_audit_logs USING btree (tenant_id);


--
-- Name: ai_business_context_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_business_context_tenant_id_idx ON public.ai_business_context USING btree (tenant_id);


--
-- Name: ai_custom_instructions_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_custom_instructions_category_idx ON public.ai_custom_instructions USING btree (category);


--
-- Name: ai_custom_instructions_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_custom_instructions_is_active_idx ON public.ai_custom_instructions USING btree (is_active);


--
-- Name: ai_custom_instructions_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_custom_instructions_tenant_id_idx ON public.ai_custom_instructions USING btree (tenant_id);


--
-- Name: ai_knowledge_base_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_knowledge_base_category_idx ON public.ai_knowledge_base USING btree (category);


--
-- Name: ai_knowledge_base_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_knowledge_base_is_active_idx ON public.ai_knowledge_base USING btree (is_active);


--
-- Name: ai_knowledge_base_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_knowledge_base_tenant_id_idx ON public.ai_knowledge_base USING btree (tenant_id);


--
-- Name: ai_training_documents_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_training_documents_category_idx ON public.ai_training_documents USING btree (category);


--
-- Name: ai_training_documents_is_processed_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_training_documents_is_processed_idx ON public.ai_training_documents USING btree (is_processed);


--
-- Name: ai_training_documents_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ai_training_documents_tenant_id_idx ON public.ai_training_documents USING btree (tenant_id);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_tenant_id_idx ON public.audit_logs USING btree (tenant_id);


--
-- Name: audit_logs_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_timestamp_idx ON public.audit_logs USING btree ("timestamp");


--
-- Name: audit_logs_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_user_id_idx ON public.audit_logs USING btree (user_id);


--
-- Name: auto_reply_log_lead_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auto_reply_log_lead_id_idx ON public.auto_reply_log USING btree (lead_id);


--
-- Name: auto_reply_log_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auto_reply_log_tenant_id_idx ON public.auto_reply_log USING btree (tenant_id);


--
-- Name: auto_responder_logs_status_scheduled_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auto_responder_logs_status_scheduled_idx ON public.auto_responder_logs USING btree (status, scheduled_for);


--
-- Name: auto_responder_logs_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auto_responder_logs_tenant_id_idx ON public.auto_responder_logs USING btree (tenant_id);


--
-- Name: auto_responder_logs_tenant_lead_template_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auto_responder_logs_tenant_lead_template_idx ON public.auto_responder_logs USING btree (tenant_id, lead_id, template_id);


--
-- Name: availability_rules_schedule_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX availability_rules_schedule_id_idx ON public.availability_rules USING btree (schedule_id);


--
-- Name: availability_schedules_public_link_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX availability_schedules_public_link_idx ON public.availability_schedules USING btree (public_link);


--
-- Name: availability_schedules_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX availability_schedules_tenant_id_idx ON public.availability_schedules USING btree (tenant_id);


--
-- Name: bookable_services_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookable_services_is_active_idx ON public.bookable_services USING btree (is_active);


--
-- Name: bookable_services_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookable_services_tenant_id_idx ON public.bookable_services USING btree (tenant_id);


--
-- Name: bookings_contact_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_contact_id_idx ON public.bookings USING btree (contact_id);


--
-- Name: bookings_service_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_service_id_idx ON public.bookings USING btree (service_id);


--
-- Name: bookings_start_time_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_start_time_idx ON public.bookings USING btree (start_time);


--
-- Name: bookings_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_status_idx ON public.bookings USING btree (status);


--
-- Name: bookings_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bookings_tenant_id_idx ON public.bookings USING btree (tenant_id);


--
-- Name: calendar_integrations_provider_service_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX calendar_integrations_provider_service_idx ON public.calendar_integrations USING btree (provider, service_type);


--
-- Name: calendars_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX calendars_tenant_id_idx ON public.calendars USING btree (tenant_id);


--
-- Name: calendars_tenant_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX calendars_tenant_type_idx ON public.calendars USING btree (tenant_id, type);


--
-- Name: chat_conversations_contact_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chat_conversations_contact_id_idx ON public.chat_conversations USING btree (contact_id);


--
-- Name: chat_conversations_is_converted_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chat_conversations_is_converted_idx ON public.chat_conversations USING btree (is_converted);


--
-- Name: chat_conversations_lead_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chat_conversations_lead_id_idx ON public.chat_conversations USING btree (lead_id);


--
-- Name: chat_conversations_session_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chat_conversations_session_id_idx ON public.chat_conversations USING btree (session_id);


--
-- Name: chat_conversations_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chat_conversations_tenant_id_idx ON public.chat_conversations USING btree (tenant_id);


--
-- Name: chat_messages_conversation_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chat_messages_conversation_id_idx ON public.chat_messages USING btree (conversation_id);


--
-- Name: chat_messages_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chat_messages_role_idx ON public.chat_messages USING btree (role);


--
-- Name: chat_messages_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX chat_messages_tenant_id_idx ON public.chat_messages USING btree (tenant_id);


--
-- Name: contact_field_defs_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_field_defs_tenant_id_idx ON public.contact_field_definitions USING btree (tenant_id);


--
-- Name: contact_field_defs_tenant_name_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX contact_field_defs_tenant_name_unique ON public.contact_field_definitions USING btree (tenant_id, name);


--
-- Name: contact_field_values_contact_field_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX contact_field_values_contact_field_unique ON public.contact_field_values USING btree (contact_id, field_definition_id);


--
-- Name: contact_field_values_tenant_contact_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_field_values_tenant_contact_idx ON public.contact_field_values USING btree (tenant_id, contact_id);


--
-- Name: contact_field_values_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contact_field_values_tenant_id_idx ON public.contact_field_values USING btree (tenant_id);


--
-- Name: contract_templates_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contract_templates_tenant_id_idx ON public.contract_templates USING btree (tenant_id);


--
-- Name: contracts_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contracts_tenant_id_idx ON public.contracts USING btree (tenant_id);


--
-- Name: contracts_tenant_project_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX contracts_tenant_project_idx ON public.contracts USING btree (tenant_id, project_id);


--
-- Name: document_views_tenant_document_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX document_views_tenant_document_idx ON public.document_views USING btree (tenant_id, document_type, document_id);


--
-- Name: email_action_items_email_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_action_items_email_id_idx ON public.email_action_items USING btree (email_id);


--
-- Name: email_action_items_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_action_items_status_idx ON public.email_action_items USING btree (status);


--
-- Name: email_action_items_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_action_items_tenant_id_idx ON public.email_action_items USING btree (tenant_id);


--
-- Name: email_action_items_thread_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_action_items_thread_id_idx ON public.email_action_items USING btree (thread_id);


--
-- Name: email_drafts_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_drafts_tenant_id_idx ON public.email_drafts USING btree (tenant_id);


--
-- Name: email_drafts_thread_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_drafts_thread_id_idx ON public.email_drafts USING btree (thread_id);


--
-- Name: email_provider_configs_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_provider_configs_tenant_id_idx ON public.email_provider_configs USING btree (tenant_id);


--
-- Name: email_provider_configs_tenant_provider_name_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX email_provider_configs_tenant_provider_name_unique ON public.email_provider_configs USING btree (tenant_id, name);


--
-- Name: email_provider_integrations_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_provider_integrations_status_idx ON public.email_accounts USING btree (status);


--
-- Name: email_provider_integrations_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_provider_integrations_tenant_id_idx ON public.email_accounts USING btree (tenant_id);


--
-- Name: email_provider_integrations_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_provider_integrations_user_id_idx ON public.email_accounts USING btree (user_id);


--
-- Name: email_signatures_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_signatures_tenant_id_idx ON public.email_signatures USING btree (tenant_id);


--
-- Name: email_signatures_tenant_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_signatures_tenant_user_idx ON public.email_signatures USING btree (tenant_id, user_id);


--
-- Name: email_summaries_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_summaries_tenant_id_idx ON public.email_summaries USING btree (tenant_id);


--
-- Name: email_summaries_tenant_thread_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX email_summaries_tenant_thread_unique ON public.email_summaries USING btree (tenant_id, thread_id);


--
-- Name: email_summaries_thread_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_summaries_thread_id_idx ON public.email_summaries USING btree (thread_id);


--
-- Name: email_thread_reads_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_thread_reads_tenant_id_idx ON public.email_thread_reads USING btree (tenant_id);


--
-- Name: events_calendar_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX events_calendar_id_idx ON public.events USING btree (calendar_id);


--
-- Name: events_external_event_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX events_external_event_idx ON public.events USING btree (external_event_id);


--
-- Name: events_source_state_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX events_source_state_idx ON public.events USING btree (source, sync_state);


--
-- Name: events_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX events_tenant_id_idx ON public.events USING btree (tenant_id);


--
-- Name: form_submissions_expires_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX form_submissions_expires_at_idx ON public.form_submissions USING btree (expires_at);


--
-- Name: form_submissions_tenant_id_form_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX form_submissions_tenant_id_form_id_idx ON public.form_submissions USING btree (tenant_id, form_id);


--
-- Name: idx_activities_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_tenant_id ON public.activities USING btree (tenant_id);


--
-- Name: idx_automation_rules_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_automation_rules_tenant_id ON public.automations USING btree (tenant_id);


--
-- Name: idx_calendar_integrations_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calendar_integrations_tenant_id ON public.calendar_integrations USING btree (tenant_id);


--
-- Name: idx_contacts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_created_at ON public.contacts USING btree (created_at DESC);


--
-- Name: idx_contacts_tenant_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_tenant_created ON public.contacts USING btree (tenant_id, created_at DESC);


--
-- Name: idx_contacts_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_tenant_id ON public.contacts USING btree (tenant_id);


--
-- Name: idx_contacts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_user_id ON public.contacts USING btree (user_id);


--
-- Name: idx_contracts_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contracts_tenant_id ON public.contracts USING btree (tenant_id);


--
-- Name: idx_email_attachments_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_attachments_tenant_id ON public.email_attachments USING btree (tenant_id);


--
-- Name: idx_email_threads_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_threads_tenant_id ON public.email_threads USING btree (tenant_id);


--
-- Name: idx_email_threads_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_threads_user_id ON public.email_threads USING btree (user_id);


--
-- Name: idx_emails_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emails_tenant_id ON public.emails USING btree (tenant_id);


--
-- Name: idx_emails_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emails_user_id ON public.emails USING btree (user_id);


--
-- Name: idx_invoices_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invoices_tenant_id ON public.invoices USING btree (tenant_id);


--
-- Name: idx_job_exec_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_exec_tenant_id ON public.job_executions USING btree (tenant_id);


--
-- Name: idx_job_executions_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_executions_tenant_id ON public.job_executions USING btree (tenant_id);


--
-- Name: idx_job_executions_tenant_job; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_executions_tenant_job ON public.job_executions USING btree (tenant_id, job_id);


--
-- Name: idx_jobs_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_tenant_id ON public.jobs USING btree (tenant_id);


--
-- Name: idx_jobs_tenant_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_jobs_tenant_status ON public.jobs USING btree (tenant_id, status);


--
-- Name: idx_lead_automation_rules_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_automation_rules_tenant_id ON public.lead_automation_rules USING btree (tenant_id);


--
-- Name: idx_lead_capture_forms_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_capture_forms_tenant_id ON public.lead_capture_forms USING btree (tenant_id);


--
-- Name: idx_lead_custom_field_responses_lead_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_custom_field_responses_lead_id ON public.lead_custom_field_responses USING btree (lead_id);


--
-- Name: idx_lead_custom_field_responses_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_custom_field_responses_tenant_id ON public.lead_custom_field_responses USING btree (tenant_id);


--
-- Name: idx_lead_custom_fields_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_custom_fields_tenant_id ON public.lead_custom_fields USING btree (tenant_id);


--
-- Name: idx_leads_event_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_event_location ON public.leads USING btree (event_location);


--
-- Name: idx_leads_tenant_event_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_tenant_event_type ON public.leads USING btree (tenant_id, event_type);


--
-- Name: idx_leads_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_tenant_id ON public.leads USING btree (tenant_id);


--
-- Name: idx_leads_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_user_id ON public.leads USING btree (user_id);


--
-- Name: idx_members_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_members_tenant_id ON public.members USING btree (tenant_id);


--
-- Name: idx_message_templates_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_templates_tenant_id ON public.message_templates USING btree (tenant_id);


--
-- Name: idx_message_threads_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_message_threads_tenant_id ON public.message_threads USING btree (tenant_id);


--
-- Name: idx_payment_sessions_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_sessions_tenant_id ON public.payment_sessions USING btree (tenant_id);


--
-- Name: idx_project_files_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_files_tenant_id ON public.project_files USING btree (tenant_id);


--
-- Name: idx_projects_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_created_at ON public.projects USING btree (created_at DESC);


--
-- Name: idx_projects_tenant_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_tenant_created ON public.projects USING btree (tenant_id, created_at DESC);


--
-- Name: idx_projects_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_tenant_id ON public.projects USING btree (tenant_id);


--
-- Name: idx_projects_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_user_id ON public.projects USING btree (user_id);


--
-- Name: idx_quote_items_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quote_items_tenant_id ON public.quote_items USING btree (tenant_id);


--
-- Name: idx_quotes_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotes_tenant_id ON public.quotes USING btree (tenant_id);


--
-- Name: idx_sms_messages_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sms_messages_tenant_id ON public.sms_messages USING btree (tenant_id);


--
-- Name: idx_tasks_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_tenant_id ON public.tasks USING btree (tenant_id);


--
-- Name: idx_templates_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_templates_tenant_id ON public.templates USING btree (tenant_id);


--
-- Name: idx_user_prefs_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_prefs_tenant_id ON public.user_prefs USING btree (tenant_id);


--
-- Name: idx_users_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_tenant_id ON public.users USING btree (tenant_id);


--
-- Name: idx_venues_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_venues_tenant_id ON public.venues USING btree (tenant_id);


--
-- Name: income_categories_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX income_categories_tenant_id_idx ON public.income_categories USING btree (tenant_id);


--
-- Name: income_categories_tenant_name_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX income_categories_tenant_name_unique ON public.income_categories USING btree (tenant_id, name);


--
-- Name: invoice_items_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX invoice_items_tenant_id_idx ON public.invoice_items USING btree (tenant_id);


--
-- Name: invoice_items_tenant_internal_name_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX invoice_items_tenant_internal_name_unique ON public.invoice_items USING btree (tenant_id, internal_name);


--
-- Name: invoice_line_items_invoice_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX invoice_line_items_invoice_id_idx ON public.invoice_line_items USING btree (invoice_id);


--
-- Name: invoice_line_items_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX invoice_line_items_tenant_id_idx ON public.invoice_line_items USING btree (tenant_id);


--
-- Name: invoices_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX invoices_tenant_id_idx ON public.invoices USING btree (tenant_id);


--
-- Name: invoices_tenant_project_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX invoices_tenant_project_idx ON public.invoices USING btree (tenant_id, project_id);


--
-- Name: job_executions_job_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_executions_job_id_idx ON public.job_executions USING btree (job_id);


--
-- Name: job_executions_started_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_executions_started_at_idx ON public.job_executions USING btree (started_at);


--
-- Name: job_executions_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX job_executions_status_idx ON public.job_executions USING btree (status);


--
-- Name: jobs_next_run_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX jobs_next_run_at_idx ON public.jobs USING btree (next_run_at);


--
-- Name: jobs_priority_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX jobs_priority_idx ON public.jobs USING btree (priority);


--
-- Name: jobs_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX jobs_status_idx ON public.jobs USING btree (status);


--
-- Name: jobs_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX jobs_type_idx ON public.jobs USING btree (type);


--
-- Name: lead_consents_tenant_id_form_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lead_consents_tenant_id_form_id_idx ON public.lead_consents USING btree (tenant_id, form_id);


--
-- Name: lead_consents_tenant_id_lead_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lead_consents_tenant_id_lead_id_idx ON public.lead_consents USING btree (tenant_id, lead_id);


--
-- Name: lead_notifications_lead_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lead_notifications_lead_id_idx ON public.lead_follow_up_notifications USING btree (lead_id);


--
-- Name: lead_notifications_priority_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lead_notifications_priority_idx ON public.lead_follow_up_notifications USING btree (priority);


--
-- Name: lead_notifications_read_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lead_notifications_read_idx ON public.lead_follow_up_notifications USING btree (read);


--
-- Name: lead_notifications_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lead_notifications_tenant_id_idx ON public.lead_follow_up_notifications USING btree (tenant_id);


--
-- Name: lead_notifications_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lead_notifications_user_id_idx ON public.lead_follow_up_notifications USING btree (user_id);


--
-- Name: mail_settings_audit_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX mail_settings_audit_tenant_id_idx ON public.mail_settings_audit USING btree (tenant_id);


--
-- Name: mail_settings_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX mail_settings_tenant_id_idx ON public.mail_settings USING btree (tenant_id);


--
-- Name: media_library_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_library_category_idx ON public.media_library USING btree (category);


--
-- Name: media_library_file_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_library_file_type_idx ON public.media_library USING btree (file_type);


--
-- Name: media_library_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_library_is_active_idx ON public.media_library USING btree (is_active);


--
-- Name: media_library_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX media_library_tenant_id_idx ON public.media_library USING btree (tenant_id);


--
-- Name: notification_settings_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_settings_tenant_id_idx ON public.notification_settings USING btree (tenant_id);


--
-- Name: notification_settings_tenant_wide_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notification_settings_tenant_wide_unique ON public.notification_settings USING btree (tenant_id) WHERE (user_id IS NULL);


--
-- Name: notification_settings_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX notification_settings_user_id_idx ON public.notification_settings USING btree (user_id);


--
-- Name: notification_settings_user_specific_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX notification_settings_user_specific_unique ON public.notification_settings USING btree (tenant_id, user_id) WHERE (user_id IS NOT NULL);


--
-- Name: payment_installments_schedule_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payment_installments_schedule_id_idx ON public.payment_installments USING btree (payment_schedule_id);


--
-- Name: payment_installments_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payment_installments_tenant_id_idx ON public.payment_installments USING btree (tenant_id);


--
-- Name: payment_schedules_invoice_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payment_schedules_invoice_id_idx ON public.payment_schedules USING btree (invoice_id);


--
-- Name: payment_schedules_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payment_schedules_tenant_id_idx ON public.payment_schedules USING btree (tenant_id);


--
-- Name: payment_transactions_invoice_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payment_transactions_invoice_id_idx ON public.payment_transactions USING btree (invoice_id);


--
-- Name: payment_transactions_stripe_intent_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payment_transactions_stripe_intent_idx ON public.payment_transactions USING btree (stripe_payment_intent_id);


--
-- Name: payment_transactions_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX payment_transactions_tenant_id_idx ON public.payment_transactions USING btree (tenant_id);


--
-- Name: quotes_tenant_contact_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotes_tenant_contact_idx ON public.quotes USING btree (tenant_id, contact_id);


--
-- Name: quotes_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX quotes_tenant_id_idx ON public.quotes USING btree (tenant_id);


--
-- Name: recurring_invoice_settings_invoice_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recurring_invoice_settings_invoice_id_idx ON public.recurring_invoice_settings USING btree (invoice_id);


--
-- Name: recurring_invoice_settings_next_send_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recurring_invoice_settings_next_send_date_idx ON public.recurring_invoice_settings USING btree (next_send_date);


--
-- Name: recurring_invoice_settings_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX recurring_invoice_settings_tenant_id_idx ON public.recurring_invoice_settings USING btree (tenant_id);


--
-- Name: schedule_calendar_checks_calendar_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX schedule_calendar_checks_calendar_id_idx ON public.schedule_calendar_checks USING btree (calendar_integration_id);


--
-- Name: schedule_calendar_checks_schedule_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX schedule_calendar_checks_schedule_id_idx ON public.schedule_calendar_checks USING btree (schedule_id);


--
-- Name: schedule_services_schedule_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX schedule_services_schedule_id_idx ON public.schedule_services USING btree (schedule_id);


--
-- Name: schedule_services_service_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX schedule_services_service_id_idx ON public.schedule_services USING btree (service_id);


--
-- Name: schedule_team_members_member_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX schedule_team_members_member_id_idx ON public.schedule_team_members USING btree (member_id);


--
-- Name: schedule_team_members_schedule_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX schedule_team_members_schedule_id_idx ON public.schedule_team_members USING btree (schedule_id);


--
-- Name: tags_tenant_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tags_tenant_category_idx ON public.tags USING btree (tenant_id, category);


--
-- Name: tags_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tags_tenant_id_idx ON public.tags USING btree (tenant_id);


--
-- Name: tax_settings_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tax_settings_tenant_id_idx ON public.tax_settings USING btree (tenant_id);


--
-- Name: tenant_onboarding_progress_is_completed_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenant_onboarding_progress_is_completed_idx ON public.tenant_onboarding_progress USING btree (is_completed);


--
-- Name: tenant_onboarding_progress_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenant_onboarding_progress_tenant_id_idx ON public.tenant_onboarding_progress USING btree (tenant_id);


--
-- Name: user_style_samples_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_style_samples_tenant_id_idx ON public.user_style_samples USING btree (tenant_id);


--
-- Name: user_style_samples_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_style_samples_user_id_idx ON public.user_style_samples USING btree (user_id);


--
-- Name: venues_name_search_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX venues_name_search_idx ON public.venues USING btree (lower(name));


--
-- Name: venues_place_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX venues_place_id_idx ON public.venues USING btree (place_id) WHERE (place_id IS NOT NULL);


--
-- Name: venues_preferred_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX venues_preferred_idx ON public.venues USING btree (preferred) WHERE (preferred = true);


--
-- Name: venues_tenant_created_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX venues_tenant_created_idx ON public.venues USING btree (tenant_id, created_at);


--
-- Name: venues_tenant_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX venues_tenant_name_idx ON public.venues USING btree (tenant_id, name);


--
-- Name: venues_tenant_normalized_address_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX venues_tenant_normalized_address_idx ON public.venues USING btree (tenant_id, normalized_address);


--
-- Name: venues_tenant_normalized_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX venues_tenant_normalized_name_idx ON public.venues USING btree (tenant_id, normalized_name);


--
-- Name: widget_settings_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX widget_settings_tenant_id_idx ON public.widget_settings USING btree (tenant_id);


--
-- Name: activities activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: activities activities_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: activities activities_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: activities activities_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: admin_audit_logs admin_audit_logs_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.users(id);


--
-- Name: admin_audit_logs admin_audit_logs_impersonated_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_impersonated_user_id_fkey FOREIGN KEY (impersonated_user_id) REFERENCES public.users(id);


--
-- Name: admin_audit_logs admin_audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ai_business_context ai_business_context_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_business_context
    ADD CONSTRAINT ai_business_context_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ai_custom_instructions ai_custom_instructions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_custom_instructions
    ADD CONSTRAINT ai_custom_instructions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ai_knowledge_base ai_knowledge_base_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_knowledge_base
    ADD CONSTRAINT ai_knowledge_base_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: ai_knowledge_base ai_knowledge_base_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_knowledge_base
    ADD CONSTRAINT ai_knowledge_base_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ai_training_documents ai_training_documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_training_documents
    ADD CONSTRAINT ai_training_documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: ai_training_documents ai_training_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_training_documents
    ADD CONSTRAINT ai_training_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: auto_reply_log auto_reply_log_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_reply_log
    ADD CONSTRAINT auto_reply_log_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.emails(id) ON DELETE SET NULL;


--
-- Name: auto_reply_log auto_reply_log_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_reply_log
    ADD CONSTRAINT auto_reply_log_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: auto_reply_log auto_reply_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_reply_log
    ADD CONSTRAINT auto_reply_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: auto_responder_logs auto_responder_logs_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_responder_logs
    ADD CONSTRAINT auto_responder_logs_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.lead_capture_forms(id);


--
-- Name: auto_responder_logs auto_responder_logs_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_responder_logs
    ADD CONSTRAINT auto_responder_logs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: auto_responder_logs auto_responder_logs_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_responder_logs
    ADD CONSTRAINT auto_responder_logs_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id);


--
-- Name: auto_responder_logs auto_responder_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auto_responder_logs
    ADD CONSTRAINT auto_responder_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: automations automation_rules_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automation_rules_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: automations automations_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: automations automations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.automations
    ADD CONSTRAINT automations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: availability_rules availability_rules_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability_rules
    ADD CONSTRAINT availability_rules_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.availability_schedules(id) ON DELETE CASCADE;


--
-- Name: availability_schedules availability_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability_schedules
    ADD CONSTRAINT availability_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bookable_services bookable_services_approval_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookable_services
    ADD CONSTRAINT bookable_services_approval_calendar_id_fkey FOREIGN KEY (approval_calendar_id) REFERENCES public.calendar_integrations(id);


--
-- Name: bookable_services bookable_services_cancellation_message_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookable_services
    ADD CONSTRAINT bookable_services_cancellation_message_template_id_fkey FOREIGN KEY (cancellation_message_template_id) REFERENCES public.message_templates(id);


--
-- Name: bookable_services bookable_services_confirmation_message_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookable_services
    ADD CONSTRAINT bookable_services_confirmation_message_template_id_fkey FOREIGN KEY (confirmation_message_template_id) REFERENCES public.message_templates(id);


--
-- Name: bookable_services bookable_services_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookable_services
    ADD CONSTRAINT bookable_services_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: bookable_services bookable_services_reminder_message_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookable_services
    ADD CONSTRAINT bookable_services_reminder_message_template_id_fkey FOREIGN KEY (reminder_message_template_id) REFERENCES public.message_templates(id);


--
-- Name: bookable_services bookable_services_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookable_services
    ADD CONSTRAINT bookable_services_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: bookings bookings_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: bookings bookings_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.availability_schedules(id);


--
-- Name: bookings bookings_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.bookable_services(id);


--
-- Name: bookings bookings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: calendar_integrations calendar_integrations_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_integrations
    ADD CONSTRAINT calendar_integrations_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: calendar_integrations calendar_integrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_integrations
    ADD CONSTRAINT calendar_integrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: calendar_integrations calendar_integrations_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_integrations
    ADD CONSTRAINT calendar_integrations_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: calendar_sync_log calendar_sync_log_integration_id_calendar_integrations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_sync_log
    ADD CONSTRAINT calendar_sync_log_integration_id_calendar_integrations_id_fk FOREIGN KEY (integration_id) REFERENCES public.calendar_integrations(id);


--
-- Name: calendars calendars_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendars
    ADD CONSTRAINT calendars_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: chat_conversations chat_conversations_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: chat_conversations chat_conversations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: chat_messages chat_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: contacts clients_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT clients_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: contact_field_definitions contact_field_definitions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_field_definitions
    ADD CONSTRAINT contact_field_definitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: contact_field_values contact_field_values_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_field_values
    ADD CONSTRAINT contact_field_values_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contact_field_values contact_field_values_field_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_field_values
    ADD CONSTRAINT contact_field_values_field_definition_id_fkey FOREIGN KEY (field_definition_id) REFERENCES public.contact_field_definitions(id) ON DELETE CASCADE;


--
-- Name: contact_field_values contact_field_values_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contact_field_values
    ADD CONSTRAINT contact_field_values_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: contacts contacts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: contacts contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: contacts contacts_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id);


--
-- Name: contract_templates contract_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_templates
    ADD CONSTRAINT contract_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: contract_templates contract_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contract_templates
    ADD CONSTRAINT contract_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: contracts contracts_contact_id_contacts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contact_id_contacts_id_fk FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: contracts contracts_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_quote_id_quotes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_quote_id_quotes_id_fk FOREIGN KEY (quote_id) REFERENCES public.quotes(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.contract_templates(id) ON DELETE SET NULL;


--
-- Name: contracts contracts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: document_views document_views_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_views
    ADD CONSTRAINT document_views_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: email_action_items email_action_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_action_items
    ADD CONSTRAINT email_action_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: email_action_items email_action_items_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_action_items
    ADD CONSTRAINT email_action_items_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.emails(id) ON DELETE CASCADE;


--
-- Name: email_action_items email_action_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_action_items
    ADD CONSTRAINT email_action_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: email_action_items email_action_items_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_action_items
    ADD CONSTRAINT email_action_items_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.email_threads(id) ON DELETE CASCADE;


--
-- Name: email_attachments email_attachments_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_attachments
    ADD CONSTRAINT email_attachments_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.emails(id);


--
-- Name: email_attachments email_attachments_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_attachments
    ADD CONSTRAINT email_attachments_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: email_attachments email_attachments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_attachments
    ADD CONSTRAINT email_attachments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: email_attachments email_attachments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_attachments
    ADD CONSTRAINT email_attachments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: email_drafts email_drafts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_drafts
    ADD CONSTRAINT email_drafts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: email_drafts email_drafts_in_reply_to_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_drafts
    ADD CONSTRAINT email_drafts_in_reply_to_email_id_fkey FOREIGN KEY (in_reply_to_email_id) REFERENCES public.emails(id) ON DELETE CASCADE;


--
-- Name: email_drafts email_drafts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_drafts
    ADD CONSTRAINT email_drafts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: email_drafts email_drafts_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_drafts
    ADD CONSTRAINT email_drafts_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.email_threads(id) ON DELETE CASCADE;


--
-- Name: email_accounts email_provider_integrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_provider_integrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: email_accounts email_provider_integrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_accounts
    ADD CONSTRAINT email_provider_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: email_summaries email_summaries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_summaries
    ADD CONSTRAINT email_summaries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: email_summaries email_summaries_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_summaries
    ADD CONSTRAINT email_summaries_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: email_summaries email_summaries_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_summaries
    ADD CONSTRAINT email_summaries_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.email_threads(id) ON DELETE CASCADE;


--
-- Name: email_thread_reads email_thread_reads_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_thread_reads
    ADD CONSTRAINT email_thread_reads_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.email_threads(id) ON DELETE CASCADE;


--
-- Name: email_threads email_threads_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: email_threads email_threads_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: email_threads email_threads_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: email_threads email_threads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_threads
    ADD CONSTRAINT email_threads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: emails emails_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: emails emails_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: emails emails_sent_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_sent_by_users_id_fk FOREIGN KEY (sent_by) REFERENCES public.users(id);


--
-- Name: emails emails_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: emails emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: events events_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: events events_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES public.calendars(id);


--
-- Name: events events_calendar_integration_id_calendar_integrations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_calendar_integration_id_calendar_integrations_id_fk FOREIGN KEY (calendar_integration_id) REFERENCES public.calendar_integrations(id);


--
-- Name: events events_contact_id_contacts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_contact_id_contacts_id_fk FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: events events_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: events events_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: events events_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: events events_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: form_submissions form_submissions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.lead_capture_forms(id);


--
-- Name: form_submissions form_submissions_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: income_categories income_categories_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.income_categories
    ADD CONSTRAINT income_categories_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: invoice_items invoice_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: invoice_items invoice_items_income_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_income_category_id_fkey FOREIGN KEY (income_category_id) REFERENCES public.income_categories(id);


--
-- Name: invoice_items invoice_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: invoice_line_items invoice_line_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_line_items invoice_line_items_invoice_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_item_id_fkey FOREIGN KEY (invoice_item_id) REFERENCES public.invoice_items(id);


--
-- Name: invoice_line_items invoice_line_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: invoices invoices_contact_id_contacts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_contact_id_contacts_id_fk FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_contract_id_contracts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_contract_id_contracts_id_fk FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: invoices invoices_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: job_executions job_exec_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_executions
    ADD CONSTRAINT job_exec_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: job_executions job_executions_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_executions
    ADD CONSTRAINT job_executions_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: job_executions job_executions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_executions
    ADD CONSTRAINT job_executions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: jobs jobs_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: jobs jobs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lead_automation_rules lead_automation_rules_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_automation_rules
    ADD CONSTRAINT lead_automation_rules_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lead_capture_forms lead_capture_forms_auto_responder_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_capture_forms
    ADD CONSTRAINT lead_capture_forms_auto_responder_template_id_fkey FOREIGN KEY (auto_responder_template_id) REFERENCES public.templates(id);


--
-- Name: lead_capture_forms lead_capture_forms_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_capture_forms
    ADD CONSTRAINT lead_capture_forms_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES public.calendar_integrations(id);


--
-- Name: lead_capture_forms lead_capture_forms_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_capture_forms
    ADD CONSTRAINT lead_capture_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: lead_capture_forms lead_capture_forms_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_capture_forms
    ADD CONSTRAINT lead_capture_forms_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lead_consents lead_consents_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_consents
    ADD CONSTRAINT lead_consents_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.lead_capture_forms(id);


--
-- Name: lead_consents lead_consents_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_consents
    ADD CONSTRAINT lead_consents_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_consents lead_consents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_consents
    ADD CONSTRAINT lead_consents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lead_follow_up_notifications lead_follow_up_notifications_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_up_notifications
    ADD CONSTRAINT lead_follow_up_notifications_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: lead_follow_up_notifications lead_follow_up_notifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_up_notifications
    ADD CONSTRAINT lead_follow_up_notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: lead_follow_up_notifications lead_follow_up_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_follow_up_notifications
    ADD CONSTRAINT lead_follow_up_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: lead_status_history lead_status_history_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_status_history
    ADD CONSTRAINT lead_status_history_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: leads leads_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: leads leads_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: leads leads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: mail_settings_audit mail_settings_audit_settings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mail_settings_audit
    ADD CONSTRAINT mail_settings_audit_settings_id_fkey FOREIGN KEY (settings_id) REFERENCES public.mail_settings(id) ON DELETE CASCADE;


--
-- Name: mail_settings_audit mail_settings_audit_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mail_settings_audit
    ADD CONSTRAINT mail_settings_audit_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: mail_settings mail_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mail_settings
    ADD CONSTRAINT mail_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: media_library media_library_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_library
    ADD CONSTRAINT media_library_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: media_library media_library_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.media_library
    ADD CONSTRAINT media_library_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: member_availability member_availability_member_id_members_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.member_availability
    ADD CONSTRAINT member_availability_member_id_members_id_fk FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: members members_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.members
    ADD CONSTRAINT members_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: message_templates message_templates_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: message_templates message_templates_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: message_templates message_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_templates
    ADD CONSTRAINT message_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: message_threads message_threads_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: message_threads message_threads_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: message_threads message_threads_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.message_threads
    ADD CONSTRAINT message_threads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: notification_settings notification_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: notification_settings notification_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_settings
    ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payment_installments payment_installments_payment_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_installments
    ADD CONSTRAINT payment_installments_payment_schedule_id_fkey FOREIGN KEY (payment_schedule_id) REFERENCES public.payment_schedules(id) ON DELETE CASCADE;


--
-- Name: payment_installments payment_installments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_installments
    ADD CONSTRAINT payment_installments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payment_schedules payment_schedules_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_schedules
    ADD CONSTRAINT payment_schedules_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: payment_schedules payment_schedules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_schedules
    ADD CONSTRAINT payment_schedules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payment_sessions payment_sessions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_sessions
    ADD CONSTRAINT payment_sessions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: payment_sessions payment_sessions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_sessions
    ADD CONSTRAINT payment_sessions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: payment_sessions payment_sessions_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_sessions
    ADD CONSTRAINT payment_sessions_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: payment_transactions payment_transactions_installment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES public.payment_installments(id) ON DELETE SET NULL;


--
-- Name: payment_transactions payment_transactions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: portal_forms portal_forms_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_forms
    ADD CONSTRAINT portal_forms_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: portal_forms portal_forms_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_forms
    ADD CONSTRAINT portal_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: portal_forms portal_forms_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_forms
    ADD CONSTRAINT portal_forms_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_files project_files_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_files
    ADD CONSTRAINT project_files_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_files project_files_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_files
    ADD CONSTRAINT project_files_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: project_files project_files_uploaded_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_files
    ADD CONSTRAINT project_files_uploaded_by_users_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: project_members project_members_member_id_members_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_member_id_members_id_fk FOREIGN KEY (member_id) REFERENCES public.members(id);


--
-- Name: project_members project_members_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_notes project_notes_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_notes
    ADD CONSTRAINT project_notes_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_notes project_notes_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_notes
    ADD CONSTRAINT project_notes_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: projects projects_contact_id_contacts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_contact_id_contacts_id_fk FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: projects projects_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: projects projects_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: quote_extra_info_config quote_extra_info_config_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_extra_info_config
    ADD CONSTRAINT quote_extra_info_config_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id);


--
-- Name: quote_extra_info_fields quote_extra_info_fields_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_extra_info_fields
    ADD CONSTRAINT quote_extra_info_fields_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: quote_extra_info_responses quote_extra_info_responses_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_extra_info_responses
    ADD CONSTRAINT quote_extra_info_responses_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id);


--
-- Name: quote_items quote_items_addon_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_addon_id_fkey FOREIGN KEY (addon_id) REFERENCES public.quote_addons(id);


--
-- Name: quote_items quote_items_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.quote_packages(id);


--
-- Name: quote_items quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id);


--
-- Name: quote_items quote_items_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_items
    ADD CONSTRAINT quote_items_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: quote_signatures quote_signatures_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_signatures
    ADD CONSTRAINT quote_signatures_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id);


--
-- Name: quote_tokens quote_tokens_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quote_tokens
    ADD CONSTRAINT quote_tokens_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.quotes(id);


--
-- Name: quotes quotes_contact_id_contacts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_contact_id_contacts_id_fk FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: quotes quotes_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: quotes quotes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: recurring_invoice_settings recurring_invoice_settings_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_invoice_settings
    ADD CONSTRAINT recurring_invoice_settings_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: recurring_invoice_settings recurring_invoice_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_invoice_settings
    ADD CONSTRAINT recurring_invoice_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: schedule_calendar_checks schedule_calendar_checks_calendar_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_calendar_checks
    ADD CONSTRAINT schedule_calendar_checks_calendar_integration_id_fkey FOREIGN KEY (calendar_integration_id) REFERENCES public.calendar_integrations(id) ON DELETE CASCADE;


--
-- Name: schedule_calendar_checks schedule_calendar_checks_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_calendar_checks
    ADD CONSTRAINT schedule_calendar_checks_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.availability_schedules(id) ON DELETE CASCADE;


--
-- Name: schedule_services schedule_services_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_services
    ADD CONSTRAINT schedule_services_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.availability_schedules(id) ON DELETE CASCADE;


--
-- Name: schedule_services schedule_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_services
    ADD CONSTRAINT schedule_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.bookable_services(id) ON DELETE CASCADE;


--
-- Name: schedule_team_members schedule_team_members_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_team_members
    ADD CONSTRAINT schedule_team_members_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE;


--
-- Name: schedule_team_members schedule_team_members_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedule_team_members
    ADD CONSTRAINT schedule_team_members_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.availability_schedules(id) ON DELETE CASCADE;


--
-- Name: sms_messages sms_messages_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: sms_messages sms_messages_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: sms_messages sms_messages_sent_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_sent_by_users_id_fk FOREIGN KEY (sent_by) REFERENCES public.users(id);


--
-- Name: sms_messages sms_messages_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: sms_messages sms_messages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tags tags_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tasks tasks_assigned_to_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assigned_to_users_id_fk FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: tasks tasks_contact_id_contacts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_contact_id_contacts_id_fk FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tasks tasks_lead_id_leads_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_lead_id_leads_id_fk FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tax_settings tax_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tax_settings
    ADD CONSTRAINT tax_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: templates templates_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: templates templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tenant_email_prefs tenant_email_prefs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_email_prefs
    ADD CONSTRAINT tenant_email_prefs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_onboarding_progress tenant_onboarding_progress_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_onboarding_progress
    ADD CONSTRAINT tenant_onboarding_progress_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: user_prefs user_prefs_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_prefs
    ADD CONSTRAINT user_prefs_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: user_prefs user_prefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_prefs
    ADD CONSTRAINT user_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_style_samples user_style_samples_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_style_samples
    ADD CONSTRAINT user_style_samples_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: user_style_samples user_style_samples_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_style_samples
    ADD CONSTRAINT user_style_samples_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: users users_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: venues venues_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: widget_settings widget_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.widget_settings
    ADD CONSTRAINT widget_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: activities; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

--
-- Name: automations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: email_attachments; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: email_thread_reads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_thread_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: email_threads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: emails; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

--
-- Name: message_templates; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: message_threads; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: project_members; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: quotes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: sms_messages; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: venues; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict yfGbgzjy8lDkbOB1Ybaa0OzTUuZgX9xY6KGHzloNLuccXAkyr0waKnE2PIKshwB

