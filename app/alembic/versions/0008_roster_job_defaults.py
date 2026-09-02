"""persist job-default roster rows

Revision ID: 0008
Revises: 0007
Create Date: 2026-08-24
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "job_roster_entries",
        sa.Column(
            "is_job_default",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    if op.get_bind().dialect.name != "postgresql":
        return

    # Existing active assignments need to appear in both rosters immediately. Explicit
    # dated rows win; conflicting legacy assignments are left for an admin to resolve.
    op.execute(
        """
        WITH candidates AS (
            SELECT
                jobs.id AS job_id,
                jobs.assigned_ip_id AS ip_user_id,
                days.work_date::date AS work_date,
                slots.slot_number,
                slots.start_time AS slot_start,
                slots.end_time AS slot_end,
                jobs.admin_assigned AS created_by_admin_id,
                row_number() OVER (
                    PARTITION BY jobs.assigned_ip_id, days.work_date::date, slots.slot_number
                    ORDER BY jobs.id
                ) AS ip_slot_rank
            FROM jobs
            CROSS JOIN LATERAL generate_series(
                GREATEST(CURRENT_DATE, jobs.start_date),
                jobs.delivery_date,
                INTERVAL '1 day'
            ) AS days(work_date)
            JOIN roster_slot_settings AS slots ON (
                lower(trim(coalesce(jobs.job_type, ''))) = 'installation'
                OR (
                    jobs.slot_start IS NULL
                    AND jobs.slot_end IS NULL
                    AND slots.slot_number = (SELECT min(slot_number) FROM roster_slot_settings)
                )
                OR (
                    jobs.slot_start IS NOT NULL
                    AND jobs.slot_end IS NOT NULL
                    AND jobs.slot_start < slots.end_time
                    AND jobs.slot_end > slots.start_time
                )
            )
            WHERE jobs.assigned_ip_id IS NOT NULL
              AND jobs.admin_assigned IS NOT NULL
              AND jobs.start_date IS NOT NULL
              AND jobs.delivery_date >= GREATEST(CURRENT_DATE, jobs.start_date)
              AND jobs.status IN ('created', 'in_progress', 'paused')
        )
        INSERT INTO job_roster_entries (
            job_id,
            ip_user_id,
            work_date,
            slot_number,
            slot_start,
            slot_end,
            created_by_admin_id,
            is_job_default
        )
        SELECT
            candidate.job_id,
            candidate.ip_user_id,
            candidate.work_date,
            candidate.slot_number,
            candidate.slot_start,
            candidate.slot_end,
            candidate.created_by_admin_id,
            true
        FROM candidates AS candidate
        WHERE candidate.ip_slot_rank = 1
          AND NOT EXISTS (
              SELECT 1
              FROM job_roster_entries AS existing
              WHERE existing.job_id = candidate.job_id
                AND existing.work_date = candidate.work_date
                AND existing.slot_number = candidate.slot_number
          )
          AND NOT EXISTS (
              SELECT 1
              FROM job_roster_entries AS existing
              WHERE existing.ip_user_id = candidate.ip_user_id
                AND existing.work_date = candidate.work_date
                AND existing.slot_number = candidate.slot_number
          )
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM job_roster_entries WHERE is_job_default = true")
    op.drop_column("job_roster_entries", "is_job_default")
