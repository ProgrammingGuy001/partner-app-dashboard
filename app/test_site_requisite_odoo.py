import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.odoo_service import OdooService


def test_all_cabinets_omits_position_filter():
    with patch.object(OdooService, "_execute_kw", return_value=[]) as execute:
        try:
            OdooService.fetch_full_bom_data("SO1", "ALL")
        except HTTPException:
            pass

    domain = execute.call_args.args[2][0]
    assert ("x_studio_cabinet_position", "=", "ALL") not in domain


def test_repair_order_notes_escape_user_text():
    notes = OdooService._repair_order_notes(
        sales_order="SO1",
        cabinet_position="ALL",
        sr_poc=None,
        repair_reference=None,
        expected_delivery=None,
        do_number=None,
        items=[
            SimpleNamespace(
                product_name="<part>",
                quantity=1,
                component_status="new",
                responsible_department="quality",
                issue_description="A&B",
            )
        ],
    )

    assert "&lt;part&gt;" in notes
    assert "A&amp;B" in notes


def test_repair_order_create_payload_has_part_lines():
    created = {}

    def fake_execute(model, method, args, kwargs=None):
        if model == "sale.order" and method == "search_read":
            return [{"id": 7, "partner_id": [9, "Customer"]}]
        if model == "repair.order" and method == "default_get":
            return {"company_id": 1, "picking_type_id": 73, "schedule_date": "2026-07-04 00:00:00"}
        if model == "stock.picking.type" and method == "read":
            return [{"default_location_src_id": [8, "WH/Stock"], "default_location_dest_id": [15, "Production"]}]
        if model == "stock.location" and method == "search_read":
            return [{"id": 16}]
        if model == "product.product" and method == "name_search":
            return [[120756, "[MK-0294] Part"]]
        if model == "product.product" and method == "read":
            return [{"id": 120756, "uom_id": [1, "Units"]}]
        if model == "repair.order" and method == "create":
            created.update(args[0])
            return 544
        if model == "repair.order" and method == "read":
            return [{"name": "WH/RO/00482"}]
        raise AssertionError(f"Unexpected Odoo call: {model}.{method}")

    with patch.object(OdooService, "_execute_kw", side_effect=fake_execute):
        OdooService.create_repair_order_for_requisite(
            sales_order="S01716",
            cabinet_position="C1",
            sr_poc="Site Lead",
            repair_reference=None,
            expected_delivery=None,
            do_number=None,
            items=[
                SimpleNamespace(
                    product_name="[MK-0294] Part",
                    quantity=1,
                    issue_description="Need replacement",
                )
            ],
        )

    move = created["move_ids"][0][2]
    assert move["product_id"] == 120756
    assert move["product_uom_qty"] == 1.0
    assert move["product_uom"] == 1
    assert move["repair_line_type"] == "add"
    assert move["location_id"] == 8
    assert move["location_dest_id"] == 15
    assert created["x_studio_sr_poc"] == "Site Lead"


if __name__ == "__main__":
    test_all_cabinets_omits_position_filter()
    test_repair_order_notes_escape_user_text()
    test_repair_order_create_payload_has_part_lines()
