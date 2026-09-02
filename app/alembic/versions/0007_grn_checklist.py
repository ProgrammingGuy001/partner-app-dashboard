"""add the GRN checklist and map it to GRN jobs

Revision ID: 0007
Revises: 0006_roster_full_day
Create Date: 2026-08-19
"""
from alembic import op

revision = "0007"
down_revision = "0006_roster_full_day"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        INSERT INTO checklists (name, description, created_at, updated_at)
        SELECT
            'GRN Checklist',
            'Complete the linked Site GRN to record received material.',
            now(),
            now()
        WHERE NOT EXISTS (
            SELECT 1 FROM checklists WHERE lower(trim(name)) = 'grn checklist'
        )
        """
    )
    op.execute(
        """
        INSERT INTO job_type_checklists (job_type, checklist_id)
        SELECT 'grn', min(id)
        FROM checklists
        WHERE lower(trim(name)) = 'grn checklist'
        ON CONFLICT DO NOTHING
        """
    )
    op.execute(
        """
        INSERT INTO jobs_checklists (job_id, checklist_id)
        SELECT jobs.id, checklists.id
        FROM jobs
        CROSS JOIN LATERAL (
            SELECT min(id) AS id
            FROM checklists
            WHERE lower(trim(name)) = 'grn checklist'
        ) AS checklists
        WHERE lower(trim(jobs.job_type)) = 'grn'
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    # Keep the checklist and any job history; only remove the global mapping.
    op.execute("DELETE FROM job_type_checklists WHERE job_type = 'grn'")
