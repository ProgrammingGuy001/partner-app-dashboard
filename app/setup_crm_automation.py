"""Create/refresh the Odoo automation rule that fires the CRM lead webhook.

    python -m app.setup_crm_automation --base-url https://adminapi.modula.in [--dry-run]

Safe to re-run: an existing webhook rule on crm.lead pointing at /webhooks/crm/lead is
rewritten in place, never duplicated. Odoo re-fires on every stage write; the webhook's
unique (crm_lead_id, crm_stage_id) index turns a repeat into a 200 "duplicate", so no
extra guard is needed here.

Odoo 17 keeps the rule on base.automation and the webhook itself on a linked
ir.actions.server (base_automation_id), which is why this writes two records.
"""
import argparse
import sys

from app.config import settings
from app.routes.crm_webhook import STAGE_JOB_TYPES
from app.services.odoo_service import OdooService

RULE_NAME = "Push: CRM lead stage → partner app"
ACTION_NAME = "Send Webhook Notification"
WEBHOOK_PATH = "/webhooks/crm/lead"

# Odoo sends only the fields listed here (plus id/_model/_name, which it always adds),
# so this must cover every field CrmLeadPayload reads.
PAYLOAD_FIELDS = [
    "stage_id", "name", "phone", "email_from",
    "street", "street2", "city", "state_id", "zip",
]
# Whichever of these the CRM happens to have; the payload accepts any of them.
OPTIONAL_FIELDS = ["sales_order", "x_studio_sales_order", "so_number", "order_ref"]


def _rule_vals(model_id, stage_field_id):
    return {
        "name": RULE_NAME,
        "model_id": model_id,
        "active": True,
        "trigger": "on_create_or_write",
        "trigger_field_ids": [(6, 0, [stage_field_id])],
        "filter_domain": str([("stage_id", "in", sorted(STAGE_JOB_TYPES))]),
    }


def _action_vals(model_id, field_ids, webhook_url, rule_id=None):
    vals = {
        "name": ACTION_NAME,
        "model_id": model_id,
        "state": "webhook",
        "usage": "base_automation",
        "webhook_url": webhook_url,
        "webhook_field_ids": [(6, 0, field_ids)],
    }
    if rule_id:
        vals["base_automation_id"] = rule_id
    return vals


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", required=True, help="public URL of this API")
    parser.add_argument("--rule-id", type=int, help="repurpose this base.automation id")
    parser.add_argument("--username", help="overrides ODOO_USERNAME")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)

    if not settings.CRM_WEBHOOK_SECRET:
        sys.exit("CRM_WEBHOOK_SECRET is unset - the webhook would reject every call.")
    if args.username:
        OdooService.USERNAME = args.username

    webhook_url = (
        f"{args.base_url.rstrip('/')}{WEBHOOK_PATH}?token={settings.CRM_WEBHOOK_SECRET}"
    )
    ex = OdooService._execute_kw

    states = dict(ex("ir.actions.server", "fields_get", [["state"], ["selection"]])
                  ["state"]["selection"])
    if "webhook" not in states:
        sys.exit("This Odoo has no webhook server action (needs 17.0+).")

    model_id = ex("ir.model", "search", [[("model", "=", "crm.lead")]], {"limit": 1})[0]
    rows = ex(
        "ir.model.fields", "search_read",
        [[("model", "=", "crm.lead"), ("name", "in", PAYLOAD_FIELDS + OPTIONAL_FIELDS)]],
        {"fields": ["name"]},
    )
    by_name = {r["name"]: r["id"] for r in rows}
    missing = [f for f in PAYLOAD_FIELDS if f not in by_name]
    if missing:
        sys.exit(f"crm.lead is missing fields the payload needs: {missing}")
    sent = [f for f in PAYLOAD_FIELDS + OPTIONAL_FIELDS if f in by_name]
    field_ids = [by_name[f] for f in sent]

    # An existing rule wins over creating a second one that fires on the same stages.
    actions = ex(
        "ir.actions.server", "search_read",
        [[("model_id", "=", model_id), ("state", "=", "webhook"),
          ("base_automation_id", "!=", False)]],
        {"fields": ["webhook_url", "base_automation_id"]},
    )
    match = next(
        (a for a in actions
         if (args.rule_id and a["base_automation_id"]
             and a["base_automation_id"][0] == args.rule_id)
         or (not args.rule_id and WEBHOOK_PATH in (a["webhook_url"] or ""))),
        None,
    )

    print("stages: " + ", ".join(f"{s} -> {t}" for s, t in sorted(STAGE_JOB_TYPES.items())))
    print(f"target: {args.base_url.rstrip('/')}{WEBHOOK_PATH}?token=<CRM_WEBHOOK_SECRET>")
    print(f"fields: {sent}")
    print(f"reusing: {match and (match['base_automation_id'], match['id'])}")
    if args.dry_run:
        print("dry run - nothing written.")
        return

    if match:
        rule_id = match["base_automation_id"][0]
        ex("base.automation", "write", [[rule_id], _rule_vals(model_id, by_name["stage_id"])])
        ex("ir.actions.server", "write",
           [[match["id"]], _action_vals(model_id, field_ids, webhook_url)])
        print(f"updated rule {rule_id} / action {match['id']}")
    else:
        rule_id = ex("base.automation", "create", [_rule_vals(model_id, by_name["stage_id"])])
        action_id = ex("ir.actions.server", "create",
                       [_action_vals(model_id, field_ids, webhook_url, rule_id)])
        print(f"created rule {rule_id} / action {action_id}")

    sample = ex("ir.actions.server", "read",
                [[match["id"] if match else action_id], ["webhook_sample_payload"]])
    print("sample payload Odoo will send:")
    print(sample[0]["webhook_sample_payload"])


def _self_check():
    rule = _rule_vals(11, 22)
    assert rule["trigger"] == "on_create_or_write"
    assert rule["trigger_field_ids"] == [(6, 0, [22])]
    assert "'stage_id', 'in'" in rule["filter_domain"]
    assert all(str(s) in rule["filter_domain"] for s in STAGE_JOB_TYPES)
    action = _action_vals(11, [1, 2], "https://x/webhooks/crm/lead?token=s", rule_id=9)
    assert action["state"] == "webhook" and action["base_automation_id"] == 9
    assert action["webhook_field_ids"] == [(6, 0, [1, 2])]
    assert "base_automation_id" not in _action_vals(11, [1], "u")
    print("self-check ok")


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        _self_check()
    else:
        main()
