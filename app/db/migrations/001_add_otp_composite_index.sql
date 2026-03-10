-- Migration 001: Add composite index on otp_sessions
-- Matches the exact WHERE clause used by OTPService:
--   WHERE purpose = ? AND phone_number = ? AND is_used = FALSE
-- Run once against your PostgreSQL database.

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_otp_sessions_purpose_phone_is_used
    ON otp_sessions (purpose, phone_number, is_used);
