--
-- PostgreSQL database dump
--

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.14 (Homebrew)

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

--
-- Name: jobtype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.jobtype AS ENUM (
    'site_readiness',
    'site_validation',
    'installation',
    'measurement'
);

--
-- Name: admin; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin (
    email character varying,
    password character varying,
    is_active boolean DEFAULT true,
    is_approved boolean DEFAULT false,
    id integer NOT NULL,
    is_superadmin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name character varying,
    is_dev boolean DEFAULT false NOT NULL
);

--
-- Name: admin_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_attendance (
    id integer NOT NULL,
    admin_id integer NOT NULL,
    marked_at timestamp with time zone NOT NULL,
    latitude double precision,
    longitude double precision,
    manual_location character varying,
    photo_url character varying,
    notes character varying,
    matched_job_id integer,
    distance_meters double precision,
    within_geofence boolean
);

--
-- Name: admin_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: admin_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_attendance_id_seq OWNED BY public.admin_attendance.id;

--
-- Name: admin_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: admin_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_id_seq OWNED BY public.admin.id;

--
-- Name: admin_notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_notification (
    id integer NOT NULL,
    admin_id integer,
    title character varying(256) NOT NULL,
    body text NOT NULL,
    grn_id integer,
    is_read boolean NOT NULL,
    created_at timestamp with time zone NOT NULL
);

--
-- Name: admin_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: admin_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_notification_id_seq OWNED BY public.admin_notification.id;

--
-- Name: checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklist_items (
    id integer NOT NULL,
    checklist_id integer NOT NULL,
    text text NOT NULL,
    "position" integer NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

--
-- Name: checklist_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checklist_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: checklist_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checklist_items_id_seq OWNED BY public.checklist_items.id;

--
-- Name: checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checklists (
    id integer NOT NULL,
    name character varying NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL
);

--
-- Name: checklists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.checklists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: checklists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.checklists_id_seq OWNED BY public.checklists.id;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name character varying NOT NULL,
    phone_number character varying(15),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    address_line_1 character varying,
    city character varying(255),
    pincode integer,
    address_line_2 character varying,
    state character varying
);

--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;

--
-- Name: daily_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_attendance (
    id integer NOT NULL,
    job_id integer,
    phone character varying NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    recorded_at timestamp with time zone NOT NULL,
    photo_url character varying,
    manual_location character varying,
    ip_user_id integer,
    attendance_date date DEFAULT CURRENT_DATE NOT NULL,
    attendance_type character varying(16) DEFAULT 'check_in'::character varying NOT NULL,
    report_document_url character varying,
    report_data jsonb,
    checkout_source character varying(16),
    distance_meters double precision,
    within_geofence boolean,
    CONSTRAINT ck_daily_attendance_type CHECK (((attendance_type)::text = ANY ((ARRAY['check_in'::character varying, 'check_out'::character varying])::text[])))
);

--
-- Name: daily_attendance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_attendance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: daily_attendance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_attendance_id_seq OWNED BY public.daily_attendance.id;

--
-- Name: daily_job_update_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_job_update_photos (
    id integer NOT NULL,
    update_id integer NOT NULL,
    photo_url character varying NOT NULL,
    uploaded_at timestamp with time zone NOT NULL
);

--
-- Name: daily_job_update_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_job_update_photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: daily_job_update_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_job_update_photos_id_seq OWNED BY public.daily_job_update_photos.id;

--
-- Name: daily_job_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_job_updates (
    id integer NOT NULL,
    job_id integer NOT NULL,
    submitted_by_type character varying(20) NOT NULL,
    submitted_by_id integer NOT NULL,
    update_date date NOT NULL,
    notes text,
    created_at timestamp with time zone NOT NULL
);

--
-- Name: daily_job_updates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.daily_job_updates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: daily_job_updates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.daily_job_updates_id_seq OWNED BY public.daily_job_updates.id;

--
-- Name: dev_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dev_audit_log (
    id integer NOT NULL,
    actor_id integer NOT NULL,
    action character varying(64) NOT NULL,
    target_email character varying(255),
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: dev_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dev_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: dev_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dev_audit_log_id_seq OWNED BY public.dev_audit_log.id;

--
-- Name: grn_package; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grn_package (
    id integer NOT NULL,
    grn_id integer NOT NULL,
    odoo_package_id integer,
    package_name character varying(256) NOT NULL,
    is_received boolean NOT NULL,
    barcode character varying(256),
    odoo_line_id integer
);

--
-- Name: grn_package_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grn_package_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: grn_package_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grn_package_id_seq OWNED BY public.grn_package.id;

--
-- Name: invoice_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_requests (
    id integer NOT NULL,
    job_id integer NOT NULL,
    status character varying(20) NOT NULL,
    requested_at timestamp with time zone NOT NULL,
    requested_by_id integer,
    approved_at timestamp with time zone,
    approved_by_id integer,
    rejection_reason text,
    invoice_number character varying(80),
    completion_percentage integer,
    notes text,
    requested_by_ip_id integer,
    CONSTRAINT ck_invoice_completion_percentage CHECK (((completion_percentage IS NULL) OR ((completion_percentage >= 0) AND (completion_percentage <= 100)))),
    CONSTRAINT ck_invoice_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);

--
-- Name: invoice_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: invoice_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoice_requests_id_seq OWNED BY public.invoice_requests.id;

--
-- Name: ip_financials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_financials (
    id integer NOT NULL,
    user_id integer,
    pan_number text,
    is_pan_verified boolean DEFAULT false,
    account_number text,
    ifsc_code text,
    account_holder_name text,
    is_bank_verified boolean DEFAULT false,
    verified_at timestamp without time zone,
    highest_qualification character varying,
    highest_qualification_document_url character varying,
    is_education_verified boolean DEFAULT false,
    is_verified boolean DEFAULT false NOT NULL,
    pan_name text,
    kyc_consent_at timestamp with time zone
);

--
-- Name: ip_financials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ip_financials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ip_financials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ip_financials_id_seq OWNED BY public.ip_financials.id;

--
-- Name: ip_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_user (
    id integer NOT NULL,
    phone_number character varying(15) NOT NULL,
    first_name character varying(50),
    last_name character varying(50),
    city character varying(50),
    pincode integer,
    is_assigned boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    admin_access integer[],
    is_id_verified boolean DEFAULT false,
    is_phone_verified boolean DEFAULT false,
    is_internal boolean DEFAULT false NOT NULL
);

--
-- Name: ip_user_admin_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ip_user_admin_assignments (
    id integer NOT NULL,
    ip_id integer NOT NULL,
    admin_id integer NOT NULL,
    assigned_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

--
-- Name: ip_user_admin_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ip_user_admin_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ip_user_admin_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ip_user_admin_assignments_id_seq OWNED BY public.ip_user_admin_assignments.id;

--
-- Name: ip_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ip_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ip_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ip_user_id_seq OWNED BY public.ip_user.id;

--
-- Name: job_approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_approval_requests (
    id integer NOT NULL,
    job_id integer NOT NULL,
    action character varying(16) NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    reason text NOT NULL,
    requested_by_id integer,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    handover_document_link text,
    ncr_document_link text,
    project_report_document_link text,
    reviewed_by_id integer,
    reviewed_at timestamp with time zone,
    review_notes text,
    CONSTRAINT ck_job_approval_action CHECK (((action)::text = ANY ((ARRAY['start'::character varying, 'finish'::character varying])::text[]))),
    CONSTRAINT ck_job_approval_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);

--
-- Name: job_approval_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_approval_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: job_approval_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_approval_requests_id_seq OWNED BY public.job_approval_requests.id;

--
-- Name: job_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_rates (
    id integer NOT NULL,
    job_type_name character varying(100) NOT NULL,
    base_rate numeric(10,2) NOT NULL,
    location character varying DEFAULT ''::character varying NOT NULL,
    description text
);

--
-- Name: job_rates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_rates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: job_rates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_rates_id_seq OWNED BY public.job_rates.id;

--
-- Name: job_status_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_status_logs (
    id integer NOT NULL,
    job_id integer,
    status character varying(50) NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actor_type character varying(16),
    actor_id integer
);

--
-- Name: job_status_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_status_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: job_status_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_status_logs_id_seq OWNED BY public.job_status_logs.id;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id integer NOT NULL,
    customer_id integer,
    assigned_ip_id integer,
    status character varying(20) DEFAULT 'created'::character varying,
    delivery_date date,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    additional_expense numeric(10,2) DEFAULT 0.00,
    job_rate_id integer,
    area integer,
    admin_assigned bigint NOT NULL,
    start_date date,
    start_otp_verified boolean DEFAULT false,
    end_otp_verified boolean DEFAULT false,
    incentive numeric(10,2) DEFAULT 0,
    job_type character varying,
    rate_amount numeric(10,2),
    latitude double precision,
    longitude double precision,
    geofence_radius integer,
    slot_start time without time zone,
    slot_end time without time zone,
    handover_document_link character varying,
    ncr_document_link character varying,
    project_report_document_link character varying,
    sales_order character varying(100),
    drawing_document_link character varying,
    CONSTRAINT ck_job_area_positive CHECK ((area >= 0)),
    CONSTRAINT ck_job_incentive_positive CHECK ((incentive >= (0)::numeric)),
    CONSTRAINT ck_job_latitude_range CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))),
    CONSTRAINT ck_job_longitude_range CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision))),
    CONSTRAINT ck_job_rate_amount_positive CHECK ((rate_amount >= (0)::numeric)),
    CONSTRAINT ck_job_slot_pair CHECK ((((slot_start IS NULL) = (slot_end IS NULL)) AND ((slot_end IS NULL) OR (slot_end > slot_start)))),
    CONSTRAINT ck_job_status CHECK (((status)::text = ANY ((ARRAY['created'::character varying, 'pending_approval'::character varying, 'creation_rejected'::character varying, 'in_progress'::character varying, 'paused'::character varying, 'completed'::character varying])::text[])))
);

--
-- Name: jobs_admin_assigned_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_admin_assigned_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: jobs_admin_assigned_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_admin_assigned_seq OWNED BY public.jobs.admin_assigned;

--
-- Name: jobs_checklist_item_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs_checklist_item_status (
    id integer NOT NULL,
    job_id integer NOT NULL,
    checklist_item_id integer NOT NULL,
    checked boolean NOT NULL,
    is_approved boolean NOT NULL,
    review_status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    comment character varying,
    admin_comment character varying,
    document_link character varying,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    CONSTRAINT ck_checklist_item_review_status CHECK (((review_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);

--
-- Name: jobs_checklist_item_status_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_checklist_item_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: jobs_checklist_item_status_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_checklist_item_status_id_seq OWNED BY public.jobs_checklist_item_status.id;

--
-- Name: jobs_checklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs_checklists (
    id bigint NOT NULL,
    job_id integer NOT NULL,
    checklist_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    document_link character varying
);

--
-- Name: jobs_checklists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_checklists_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: jobs_checklists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_checklists_id_seq OWNED BY public.jobs_checklists.id;

--
-- Name: jobs_dropped_columns_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs_dropped_columns_backup (
    id integer,
    name character varying(255),
    checklist_link character varying(1024),
    google_map_link character varying(1024)
);

--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;

--
-- Name: media_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_documents (
    id integer NOT NULL,
    owner_type character varying(32) NOT NULL,
    owner_id integer NOT NULL,
    status character varying(64) DEFAULT 'uploaded'::character varying NOT NULL,
    doc_link character varying(1024) NOT NULL,
    comment text,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    uploaded_by_admin_id integer
);

--
-- Name: media_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: media_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_documents_id_seq OWNED BY public.media_documents.id;

--
-- Name: otp_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_sessions (
    id integer NOT NULL,
    purpose character varying(32) NOT NULL,
    phone_number character varying(32) NOT NULL,
    otp_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_user_id integer,
    job_id integer
);

--
-- Name: otp_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.otp_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: otp_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.otp_sessions_id_seq OWNED BY public.otp_sessions.id;

--
-- Name: purchase_order_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_requests (
    id integer NOT NULL,
    requested_by_id integer NOT NULL,
    approved_by_id integer,
    vendor_id integer NOT NULL,
    vendor_name character varying(255) NOT NULL,
    sales_order character varying(100),
    poc_name character varying(255),
    service_type character varying(3) NOT NULL,
    product_name character varying(255) NOT NULL,
    quantity numeric(12,2) NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    approved_at timestamp with time zone,
    po_number character varying(30),
    odoo_sync_key character varying(80) NOT NULL,
    odoo_purchase_order_id integer,
    odoo_purchase_order_name character varying(80),
    odoo_sync_error text,
    bill_status character varying(20) DEFAULT 'not_requested'::character varying NOT NULL,
    bill_requested_by_id integer,
    bill_requested_at timestamp with time zone,
    bill_approved_by_id integer,
    bill_approved_at timestamp with time zone,
    odoo_vendor_bill_id integer,
    odoo_vendor_bill_name character varying(80),
    bill_sync_error text,
    CONSTRAINT ck_po_request_bill_status CHECK (((bill_status)::text = ANY ((ARRAY['not_requested'::character varying, 'pending'::character varying, 'approved'::character varying])::text[]))),
    CONSTRAINT ck_po_request_quantity_positive CHECK ((quantity > (0)::numeric)),
    CONSTRAINT ck_po_request_service_type CHECK (((service_type)::text = ANY ((ARRAY['b2b'::character varying, 'b2c'::character varying])::text[]))),
    CONSTRAINT ck_po_request_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying])::text[]))),
    CONSTRAINT ck_po_request_unit_price_positive CHECK ((unit_price > (0)::numeric))
);

--
-- Name: purchase_order_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_order_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: purchase_order_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_order_requests_id_seq OWNED BY public.purchase_order_requests.id;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    subject character varying(255) NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;

--
-- Name: site_grn; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_grn (
    id integer NOT NULL,
    source_document character varying(128) NOT NULL,
    odoo_picking_id integer,
    ip_user_id integer,
    created_by_admin_id integer NOT NULL,
    status character varying(32) NOT NULL,
    has_missing boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    submitted_at timestamp with time zone,
    odoo_picking_name character varying(128),
    odoo_sync_error character varying(1024),
    job_id integer,
    CONSTRAINT ck_grn_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'submitted'::character varying, 'processed'::character varying])::text[])))
);

--
-- Name: site_grn_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_grn_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: site_grn_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_grn_id_seq OWNED BY public.site_grn.id;

--
-- Name: site_requisite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_requisite (
    id integer NOT NULL,
    so_detail_id integer NOT NULL,
    product_name character varying(255) NOT NULL,
    quantity numeric(10,2),
    issue_description text,
    responsible_department character varying(100),
    created_date timestamp without time zone,
    component_status character varying(100)
);

--
-- Name: site_requisite_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.site_requisite_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: site_requisite_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.site_requisite_id_seq OWNED BY public.site_requisite.id;

--
-- Name: so_detail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.so_detail (
    id integer NOT NULL,
    sales_order character varying(100) NOT NULL,
    created_date timestamp without time zone,
    closed_date timestamp without time zone,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    sr_poc character varying(255),
    cabinet_position character varying(255),
    ip_user_id integer,
    customer_name character varying(512),
    project_name character varying(512),
    delivery_address text,
    so_poc character varying(255),
    so_status character varying(100),
    repair_reference character varying(255),
    expected_delivery date,
    do_number character varying(255),
    odoo_repair_order_id integer,
    odoo_repair_order_name character varying(255),
    odoo_sync_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    odoo_sync_error character varying(1024),
    odoo_sync_key character varying(64) NOT NULL,
    CONSTRAINT ck_sodetail_odoo_sync_status CHECK (((odoo_sync_status)::text = ANY ((ARRAY['pending'::character varying, 'synced'::character varying, 'failed'::character varying])::text[]))),
    CONSTRAINT ck_sodetail_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'completed'::character varying])::text[])))
);

--
-- Name: so_detail_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.so_detail_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: so_detail_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.so_detail_id_seq OWNED BY public.so_detail.id;

--
-- Name: sunday_work_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sunday_work_requests (
    id integer NOT NULL,
    ip_user_id integer,
    request_date date NOT NULL,
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    reason character varying(500),
    reviewed_by_admin_id integer,
    reviewed_at timestamp with time zone,
    review_notes character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_id integer,
    CONSTRAINT ck_sunday_work_request_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying])::text[])))
);

--
-- Name: sunday_work_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sunday_work_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: sunday_work_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sunday_work_requests_id_seq OWNED BY public.sunday_work_requests.id;

--
-- Name: ticket_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_assignments (
    id integer NOT NULL,
    ticket_id character varying NOT NULL,
    ticket_type character varying NOT NULL,
    supervisor_id integer,
    job_id integer,
    assigned_by integer,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: ticket_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: ticket_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_assignments_id_seq OWNED BY public.ticket_assignments.id;

--
-- Name: admin id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin ALTER COLUMN id SET DEFAULT nextval('public.admin_id_seq'::regclass);

--
-- Name: admin_attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_attendance ALTER COLUMN id SET DEFAULT nextval('public.admin_attendance_id_seq'::regclass);

--
-- Name: admin_notification id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notification ALTER COLUMN id SET DEFAULT nextval('public.admin_notification_id_seq'::regclass);

--
-- Name: checklist_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_items ALTER COLUMN id SET DEFAULT nextval('public.checklist_items_id_seq'::regclass);

--
-- Name: checklists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklists ALTER COLUMN id SET DEFAULT nextval('public.checklists_id_seq'::regclass);

--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);

--
-- Name: daily_attendance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendance ALTER COLUMN id SET DEFAULT nextval('public.daily_attendance_id_seq'::regclass);

--
-- Name: daily_job_update_photos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_job_update_photos ALTER COLUMN id SET DEFAULT nextval('public.daily_job_update_photos_id_seq'::regclass);

--
-- Name: daily_job_updates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_job_updates ALTER COLUMN id SET DEFAULT nextval('public.daily_job_updates_id_seq'::regclass);

--
-- Name: dev_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dev_audit_log ALTER COLUMN id SET DEFAULT nextval('public.dev_audit_log_id_seq'::regclass);

--
-- Name: grn_package id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_package ALTER COLUMN id SET DEFAULT nextval('public.grn_package_id_seq'::regclass);

--
-- Name: invoice_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_requests ALTER COLUMN id SET DEFAULT nextval('public.invoice_requests_id_seq'::regclass);

--
-- Name: ip_financials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_financials ALTER COLUMN id SET DEFAULT nextval('public.ip_financials_id_seq'::regclass);

--
-- Name: ip_user id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_user ALTER COLUMN id SET DEFAULT nextval('public.ip_user_id_seq'::regclass);

--
-- Name: ip_user_admin_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_user_admin_assignments ALTER COLUMN id SET DEFAULT nextval('public.ip_user_admin_assignments_id_seq'::regclass);

--
-- Name: job_approval_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_approval_requests ALTER COLUMN id SET DEFAULT nextval('public.job_approval_requests_id_seq'::regclass);

--
-- Name: job_rates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_rates ALTER COLUMN id SET DEFAULT nextval('public.job_rates_id_seq'::regclass);

--
-- Name: job_status_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_status_logs ALTER COLUMN id SET DEFAULT nextval('public.job_status_logs_id_seq'::regclass);

--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);

--
-- Name: jobs admin_assigned; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN admin_assigned SET DEFAULT nextval('public.jobs_admin_assigned_seq'::regclass);

--
-- Name: jobs_checklist_item_status id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs_checklist_item_status ALTER COLUMN id SET DEFAULT nextval('public.jobs_checklist_item_status_id_seq'::regclass);

--
-- Name: jobs_checklists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs_checklists ALTER COLUMN id SET DEFAULT nextval('public.jobs_checklists_id_seq'::regclass);

--
-- Name: media_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_documents ALTER COLUMN id SET DEFAULT nextval('public.media_documents_id_seq'::regclass);

--
-- Name: otp_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_sessions ALTER COLUMN id SET DEFAULT nextval('public.otp_sessions_id_seq'::regclass);

--
-- Name: purchase_order_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_requests ALTER COLUMN id SET DEFAULT nextval('public.purchase_order_requests_id_seq'::regclass);

--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);

--
-- Name: site_grn id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_grn ALTER COLUMN id SET DEFAULT nextval('public.site_grn_id_seq'::regclass);

--
-- Name: site_requisite id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_requisite ALTER COLUMN id SET DEFAULT nextval('public.site_requisite_id_seq'::regclass);

--
-- Name: so_detail id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.so_detail ALTER COLUMN id SET DEFAULT nextval('public.so_detail_id_seq'::regclass);

--
-- Name: sunday_work_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_work_requests ALTER COLUMN id SET DEFAULT nextval('public.sunday_work_requests_id_seq'::regclass);

--
-- Name: ticket_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignments ALTER COLUMN id SET DEFAULT nextval('public.ticket_assignments_id_seq'::regclass);

--
-- Name: admin_attendance admin_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_attendance
    ADD CONSTRAINT admin_attendance_pkey PRIMARY KEY (id);

--
-- Name: admin_notification admin_notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notification
    ADD CONSTRAINT admin_notification_pkey PRIMARY KEY (id);

--
-- Name: admin admin_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin
    ADD CONSTRAINT admin_pk PRIMARY KEY (id);

--
-- Name: checklist_items checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_pkey PRIMARY KEY (id);

--
-- Name: checklists checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklists
    ADD CONSTRAINT checklists_pkey PRIMARY KEY (id);

--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);

--
-- Name: daily_attendance daily_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendance
    ADD CONSTRAINT daily_attendance_pkey PRIMARY KEY (id);

--
-- Name: daily_job_update_photos daily_job_update_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_job_update_photos
    ADD CONSTRAINT daily_job_update_photos_pkey PRIMARY KEY (id);

--
-- Name: daily_job_updates daily_job_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_job_updates
    ADD CONSTRAINT daily_job_updates_pkey PRIMARY KEY (id);

--
-- Name: dev_audit_log dev_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dev_audit_log
    ADD CONSTRAINT dev_audit_log_pkey PRIMARY KEY (id);

--
-- Name: grn_package grn_package_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_package
    ADD CONSTRAINT grn_package_pkey PRIMARY KEY (id);

--
-- Name: invoice_requests invoice_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_requests
    ADD CONSTRAINT invoice_requests_pkey PRIMARY KEY (id);

--
-- Name: ip_financials ip_financials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_financials
    ADD CONSTRAINT ip_financials_pkey PRIMARY KEY (id);

--
-- Name: ip_financials ip_financials_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_financials
    ADD CONSTRAINT ip_financials_user_id_key UNIQUE (user_id);

--
-- Name: ip_user_admin_assignments ip_user_admin_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_user_admin_assignments
    ADD CONSTRAINT ip_user_admin_assignments_pkey PRIMARY KEY (id);

--
-- Name: ip_user ip_user_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_user
    ADD CONSTRAINT ip_user_phone_number_key UNIQUE (phone_number);

--
-- Name: ip_user ip_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_user
    ADD CONSTRAINT ip_user_pkey PRIMARY KEY (id);

--
-- Name: job_approval_requests job_approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_approval_requests
    ADD CONSTRAINT job_approval_requests_pkey PRIMARY KEY (id);

--
-- Name: job_rates job_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_rates
    ADD CONSTRAINT job_rates_pkey PRIMARY KEY (id);

--
-- Name: job_status_logs job_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_status_logs
    ADD CONSTRAINT job_status_logs_pkey PRIMARY KEY (id);

--
-- Name: jobs_checklist_item_status jobs_checklist_item_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs_checklist_item_status
    ADD CONSTRAINT jobs_checklist_item_status_pkey PRIMARY KEY (id);

--
-- Name: jobs_checklists jobs_checklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs_checklists
    ADD CONSTRAINT jobs_checklists_pkey PRIMARY KEY (id);

--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);

--
-- Name: media_documents media_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_documents
    ADD CONSTRAINT media_documents_pkey PRIMARY KEY (id);

--
-- Name: otp_sessions otp_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_sessions
    ADD CONSTRAINT otp_sessions_pkey PRIMARY KEY (id);

--
-- Name: purchase_order_requests purchase_order_requests_odoo_sync_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_requests
    ADD CONSTRAINT purchase_order_requests_odoo_sync_key_key UNIQUE (odoo_sync_key);

--
-- Name: purchase_order_requests purchase_order_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_requests
    ADD CONSTRAINT purchase_order_requests_pkey PRIMARY KEY (id);

--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);

--
-- Name: site_grn site_grn_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_grn
    ADD CONSTRAINT site_grn_pkey PRIMARY KEY (id);

--
-- Name: site_requisite site_requisite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_requisite
    ADD CONSTRAINT site_requisite_pkey PRIMARY KEY (id);

--
-- Name: so_detail so_detail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.so_detail
    ADD CONSTRAINT so_detail_pkey PRIMARY KEY (id);

--
-- Name: sunday_work_requests sunday_work_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_work_requests
    ADD CONSTRAINT sunday_work_requests_pkey PRIMARY KEY (id);

--
-- Name: ticket_assignments ticket_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignments
    ADD CONSTRAINT ticket_assignments_pkey PRIMARY KEY (id);

--
-- Name: ip_user_admin_assignments uq_ip_user_admin_assignments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_user_admin_assignments
    ADD CONSTRAINT uq_ip_user_admin_assignments UNIQUE (ip_id, admin_id);

--
-- Name: jobs_checklist_item_status uq_job_checklist_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs_checklist_item_status
    ADD CONSTRAINT uq_job_checklist_item UNIQUE (job_id, checklist_item_id);

--
-- Name: jobs_checklists uq_jobs_checklists; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs_checklists
    ADD CONSTRAINT uq_jobs_checklists UNIQUE (job_id, checklist_id);

--
-- Name: sunday_work_requests uq_sunday_work_request_ip_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_work_requests
    ADD CONSTRAINT uq_sunday_work_request_ip_date UNIQUE (ip_user_id, request_date);

--
-- Name: idx_ip_user_admin_assignments_admin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ip_user_admin_assignments_admin_id ON public.ip_user_admin_assignments USING btree (admin_id);

--
-- Name: idx_ip_user_admin_assignments_ip_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ip_user_admin_assignments_ip_id ON public.ip_user_admin_assignments USING btree (ip_id);

--
-- Name: idx_ip_user_is_internal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ip_user_is_internal ON public.ip_user USING btree (is_internal);

--
-- Name: idx_jobs_checklists_checklist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_checklists_checklist_id ON public.jobs_checklists USING btree (checklist_id);

--
-- Name: idx_jobs_checklists_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_checklists_job_id ON public.jobs_checklists USING btree (job_id);

--
-- Name: idx_media_documents_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_documents_owner ON public.media_documents USING btree (owner_type, owner_id);

--
-- Name: idx_media_documents_uploaded_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_documents_uploaded_at ON public.media_documents USING btree (uploaded_at);

--
-- Name: idx_one_pending_invoice_per_job; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_one_pending_invoice_per_job ON public.invoice_requests USING btree (job_id) WHERE ((status)::text = 'pending'::text);

--
-- Name: idx_one_pending_job_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_one_pending_job_approval ON public.job_approval_requests USING btree (job_id, action) WHERE ((status)::text = 'pending'::text);

--
-- Name: idx_otp_sessions_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_sessions_job ON public.otp_sessions USING btree (job_id, purpose, is_used);

--
-- Name: idx_otp_sessions_purpose_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_otp_sessions_purpose_phone ON public.otp_sessions USING btree (purpose, phone_number, is_used);

--
-- Name: ix_admin_attendance_admin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_admin_attendance_admin_id ON public.admin_attendance USING btree (admin_id);

--
-- Name: ix_admin_attendance_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_admin_attendance_id ON public.admin_attendance USING btree (id);

--
-- Name: ix_admin_notification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_admin_notification_id ON public.admin_notification USING btree (id);

--
-- Name: ix_admin_notification_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_admin_notification_is_read ON public.admin_notification USING btree (is_read);

--
-- Name: ix_checklist_items_checklist_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_checklist_items_checklist_id ON public.checklist_items USING btree (checklist_id);

--
-- Name: ix_checklist_items_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_checklist_items_id ON public.checklist_items USING btree (id);

--
-- Name: ix_checklists_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_checklists_id ON public.checklists USING btree (id);

--
-- Name: ix_daily_attendance_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_attendance_id ON public.daily_attendance USING btree (id);

--
-- Name: ix_daily_attendance_ip_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_attendance_ip_user_id ON public.daily_attendance USING btree (ip_user_id);

--
-- Name: ix_daily_attendance_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_attendance_job_id ON public.daily_attendance USING btree (job_id);

--
-- Name: ix_daily_job_update_photos_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_job_update_photos_id ON public.daily_job_update_photos USING btree (id);

--
-- Name: ix_daily_job_update_photos_update_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_job_update_photos_update_id ON public.daily_job_update_photos USING btree (update_id);

--
-- Name: ix_daily_job_updates_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_job_updates_id ON public.daily_job_updates USING btree (id);

--
-- Name: ix_daily_job_updates_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_job_updates_job_id ON public.daily_job_updates USING btree (job_id);

--
-- Name: ix_daily_job_updates_submitted_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_job_updates_submitted_by_id ON public.daily_job_updates USING btree (submitted_by_id);

--
-- Name: ix_daily_job_updates_update_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_daily_job_updates_update_date ON public.daily_job_updates USING btree (update_date);

--
-- Name: ix_dev_audit_log_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_dev_audit_log_actor ON public.dev_audit_log USING btree (actor_id);

--
-- Name: ix_grn_package_grn_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_grn_package_grn_id ON public.grn_package USING btree (grn_id);

--
-- Name: ix_invoice_requests_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_invoice_requests_job_id ON public.invoice_requests USING btree (job_id);

--
-- Name: ix_job_approval_requests_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_job_approval_requests_job_id ON public.job_approval_requests USING btree (job_id);

--
-- Name: ix_jobs_checklist_item_status_checklist_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_jobs_checklist_item_status_checklist_item_id ON public.jobs_checklist_item_status USING btree (checklist_item_id);

--
-- Name: ix_jobs_checklist_item_status_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_jobs_checklist_item_status_id ON public.jobs_checklist_item_status USING btree (id);

--
-- Name: ix_jobs_checklist_item_status_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_jobs_checklist_item_status_job_id ON public.jobs_checklist_item_status USING btree (job_id);

--
-- Name: ix_jobs_job_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_jobs_job_type ON public.jobs USING btree (job_type);

--
-- Name: ix_jobs_sales_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_jobs_sales_order ON public.jobs USING btree (sales_order);

--
-- Name: ix_po_requests_bill_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_po_requests_bill_status ON public.purchase_order_requests USING btree (bill_status);

--
-- Name: ix_po_requests_requested_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_po_requests_requested_by ON public.purchase_order_requests USING btree (requested_by_id);

--
-- Name: ix_po_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_po_requests_status ON public.purchase_order_requests USING btree (status);

--
-- Name: ix_purchase_order_requests_po_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_purchase_order_requests_po_number ON public.purchase_order_requests USING btree (po_number);

--
-- Name: ix_refresh_tokens_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_refresh_tokens_subject ON public.refresh_tokens USING btree (subject);

--
-- Name: ix_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);

--
-- Name: ix_site_grn_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_site_grn_id ON public.site_grn USING btree (id);

--
-- Name: ix_site_grn_ip_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_site_grn_ip_user_id ON public.site_grn USING btree (ip_user_id);

--
-- Name: ix_site_grn_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_site_grn_job_id ON public.site_grn USING btree (job_id);

--
-- Name: ix_site_grn_source_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_site_grn_source_document ON public.site_grn USING btree (source_document);

--
-- Name: ix_site_requisite_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_site_requisite_id ON public.site_requisite USING btree (id);

--
-- Name: ix_so_detail_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_so_detail_id ON public.so_detail USING btree (id);

--
-- Name: ix_sunday_work_requests_admin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sunday_work_requests_admin_id ON public.sunday_work_requests USING btree (admin_id);

--
-- Name: ix_sunday_work_requests_ip_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sunday_work_requests_ip_user_id ON public.sunday_work_requests USING btree (ip_user_id);

--
-- Name: ix_sunday_work_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_sunday_work_requests_status ON public.sunday_work_requests USING btree (status);

--
-- Name: ix_ticket_assignments_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ticket_assignments_job_id ON public.ticket_assignments USING btree (job_id);

--
-- Name: ix_ticket_assignments_supervisor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ticket_assignments_supervisor_id ON public.ticket_assignments USING btree (supervisor_id);

--
-- Name: ix_ticket_assignments_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ticket_assignments_ticket_id ON public.ticket_assignments USING btree (ticket_id);

--
-- Name: uq_daily_attendance_user_job_date_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_daily_attendance_user_job_date_type ON public.daily_attendance USING btree (ip_user_id, job_id, attendance_date, attendance_type) WHERE ((ip_user_id IS NOT NULL) AND (job_id IS NOT NULL));

--
-- Name: uq_ip_admin_assignment; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ip_admin_assignment ON public.ip_user_admin_assignments USING btree (ip_id, admin_id);

--
-- Name: uq_job_checklist; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_job_checklist ON public.jobs_checklists USING btree (job_id, checklist_id);

--
-- Name: uq_job_rate_type_location; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_job_rate_type_location ON public.job_rates USING btree (job_type_name, location);

--
-- Name: uq_site_grn_odoo_picking; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_site_grn_odoo_picking ON public.site_grn USING btree (odoo_picking_id) WHERE (odoo_picking_id IS NOT NULL);

--
-- Name: uq_sodetail_odoo_sync_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sodetail_odoo_sync_key ON public.so_detail USING btree (odoo_sync_key);

--
-- Name: uq_sunday_work_request_admin_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sunday_work_request_admin_date ON public.sunday_work_requests USING btree (admin_id, request_date) WHERE (admin_id IS NOT NULL);

--
-- Name: uq_ticket_assignments_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ticket_assignments_ticket ON public.ticket_assignments USING btree (ticket_id, ticket_type);

--
-- Name: admin_attendance admin_attendance_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_attendance
    ADD CONSTRAINT admin_attendance_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin(id);

--
-- Name: admin_notification admin_notification_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notification
    ADD CONSTRAINT admin_notification_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin(id);

--
-- Name: admin_notification admin_notification_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notification
    ADD CONSTRAINT admin_notification_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.site_grn(id);

--
-- Name: checklist_items checklist_items_checklist_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checklist_items
    ADD CONSTRAINT checklist_items_checklist_id_fkey FOREIGN KEY (checklist_id) REFERENCES public.checklists(id);

--
-- Name: daily_attendance daily_attendance_ip_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendance
    ADD CONSTRAINT daily_attendance_ip_user_id_fkey FOREIGN KEY (ip_user_id) REFERENCES public.ip_user(id);

--
-- Name: daily_attendance daily_attendance_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_attendance
    ADD CONSTRAINT daily_attendance_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);

--
-- Name: daily_job_update_photos daily_job_update_photos_update_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_job_update_photos
    ADD CONSTRAINT daily_job_update_photos_update_id_fkey FOREIGN KEY (update_id) REFERENCES public.daily_job_updates(id) ON DELETE CASCADE;

--
-- Name: daily_job_updates daily_job_updates_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_job_updates
    ADD CONSTRAINT daily_job_updates_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

--
-- Name: dev_audit_log dev_audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dev_audit_log
    ADD CONSTRAINT dev_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.admin(id);

--
-- Name: ip_financials fk_ip_financials_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_financials
    ADD CONSTRAINT fk_ip_financials_user FOREIGN KEY (user_id) REFERENCES public.ip_user(id) ON DELETE CASCADE;

--
-- Name: jobs fk_job_rates; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT fk_job_rates FOREIGN KEY (job_rate_id) REFERENCES public.job_rates(id);

--
-- Name: jobs fk_jobs_admin_assigned; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT fk_jobs_admin_assigned FOREIGN KEY (admin_assigned) REFERENCES public.admin(id) ON UPDATE CASCADE ON DELETE SET NULL;

--
-- Name: grn_package grn_package_grn_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grn_package
    ADD CONSTRAINT grn_package_grn_id_fkey FOREIGN KEY (grn_id) REFERENCES public.site_grn(id);

--
-- Name: invoice_requests invoice_requests_approved_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_requests
    ADD CONSTRAINT invoice_requests_approved_by_id_fkey FOREIGN KEY (approved_by_id) REFERENCES public.admin(id);

--
-- Name: invoice_requests invoice_requests_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_requests
    ADD CONSTRAINT invoice_requests_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

--
-- Name: invoice_requests invoice_requests_requested_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_requests
    ADD CONSTRAINT invoice_requests_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES public.admin(id);

--
-- Name: invoice_requests invoice_requests_requested_by_ip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_requests
    ADD CONSTRAINT invoice_requests_requested_by_ip_id_fkey FOREIGN KEY (requested_by_ip_id) REFERENCES public.ip_user(id);

--
-- Name: ip_user_admin_assignments ip_user_admin_assignments_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_user_admin_assignments
    ADD CONSTRAINT ip_user_admin_assignments_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin(id) ON DELETE CASCADE;

--
-- Name: ip_user_admin_assignments ip_user_admin_assignments_ip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ip_user_admin_assignments
    ADD CONSTRAINT ip_user_admin_assignments_ip_id_fkey FOREIGN KEY (ip_id) REFERENCES public.ip_user(id) ON DELETE CASCADE;

--
-- Name: job_approval_requests job_approval_requests_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_approval_requests
    ADD CONSTRAINT job_approval_requests_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

--
-- Name: job_approval_requests job_approval_requests_requested_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_approval_requests
    ADD CONSTRAINT job_approval_requests_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES public.admin(id);

--
-- Name: job_approval_requests job_approval_requests_reviewed_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_approval_requests
    ADD CONSTRAINT job_approval_requests_reviewed_by_id_fkey FOREIGN KEY (reviewed_by_id) REFERENCES public.admin(id);

--
-- Name: job_status_logs job_status_logs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_status_logs
    ADD CONSTRAINT job_status_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

--
-- Name: jobs jobs_assigned_ip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_assigned_ip_id_fkey FOREIGN KEY (assigned_ip_id) REFERENCES public.ip_user(id);

--
-- Name: jobs_checklist_item_status jobs_checklist_item_status_checklist_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs_checklist_item_status
    ADD CONSTRAINT jobs_checklist_item_status_checklist_item_id_fkey FOREIGN KEY (checklist_item_id) REFERENCES public.checklist_items(id);

--
-- Name: jobs_checklist_item_status jobs_checklist_item_status_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs_checklist_item_status
    ADD CONSTRAINT jobs_checklist_item_status_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);

--
-- Name: jobs_checklists jobs_checklists_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs_checklists
    ADD CONSTRAINT jobs_checklists_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

--
-- Name: jobs jobs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);

--
-- Name: media_documents media_documents_uploaded_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_documents
    ADD CONSTRAINT media_documents_uploaded_by_admin_id_fkey FOREIGN KEY (uploaded_by_admin_id) REFERENCES public.admin(id);

--
-- Name: otp_sessions otp_sessions_ip_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_sessions
    ADD CONSTRAINT otp_sessions_ip_user_id_fkey FOREIGN KEY (ip_user_id) REFERENCES public.ip_user(id) ON DELETE CASCADE;

--
-- Name: otp_sessions otp_sessions_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_sessions
    ADD CONSTRAINT otp_sessions_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;

--
-- Name: purchase_order_requests purchase_order_requests_approved_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_requests
    ADD CONSTRAINT purchase_order_requests_approved_by_id_fkey FOREIGN KEY (approved_by_id) REFERENCES public.admin(id);

--
-- Name: purchase_order_requests purchase_order_requests_bill_approved_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_requests
    ADD CONSTRAINT purchase_order_requests_bill_approved_by_id_fkey FOREIGN KEY (bill_approved_by_id) REFERENCES public.admin(id);

--
-- Name: purchase_order_requests purchase_order_requests_bill_requested_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_requests
    ADD CONSTRAINT purchase_order_requests_bill_requested_by_id_fkey FOREIGN KEY (bill_requested_by_id) REFERENCES public.admin(id);

--
-- Name: purchase_order_requests purchase_order_requests_requested_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_requests
    ADD CONSTRAINT purchase_order_requests_requested_by_id_fkey FOREIGN KEY (requested_by_id) REFERENCES public.admin(id);

--
-- Name: site_grn site_grn_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_grn
    ADD CONSTRAINT site_grn_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin(id);

--
-- Name: site_grn site_grn_ip_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_grn
    ADD CONSTRAINT site_grn_ip_user_id_fkey FOREIGN KEY (ip_user_id) REFERENCES public.ip_user(id);

--
-- Name: site_grn site_grn_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_grn
    ADD CONSTRAINT site_grn_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);

--
-- Name: site_requisite site_requisite_so_detail_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_requisite
    ADD CONSTRAINT site_requisite_so_detail_id_fkey FOREIGN KEY (so_detail_id) REFERENCES public.so_detail(id);

--
-- Name: sunday_work_requests sunday_work_requests_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_work_requests
    ADD CONSTRAINT sunday_work_requests_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin(id);

--
-- Name: sunday_work_requests sunday_work_requests_ip_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_work_requests
    ADD CONSTRAINT sunday_work_requests_ip_user_id_fkey FOREIGN KEY (ip_user_id) REFERENCES public.ip_user(id);

--
-- Name: sunday_work_requests sunday_work_requests_reviewed_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sunday_work_requests
    ADD CONSTRAINT sunday_work_requests_reviewed_by_admin_id_fkey FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.admin(id);

--
-- Name: ticket_assignments ticket_assignments_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignments
    ADD CONSTRAINT ticket_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.admin(id) ON DELETE SET NULL;

--
-- Name: ticket_assignments ticket_assignments_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignments
    ADD CONSTRAINT ticket_assignments_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;

--
-- Name: ticket_assignments ticket_assignments_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_assignments
    ADD CONSTRAINT ticket_assignments_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.admin(id) ON DELETE SET NULL;

--
-- PostgreSQL database dump complete
--
