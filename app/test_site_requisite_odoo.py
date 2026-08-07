import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schemas.requisite_schema import BOMItemResponse
from app.services.odoo_service import OdooService
from app.services.requisite_service import RequisiteService


def test_all_cabinets_omits_position_filter():
    with (
        patch.object(OdooService, "COMPANY_ID", 5),
        patch.object(OdooService, "_execute_kw", return_value=[]) as execute,
    ):
        try:
            OdooService.fetch_full_bom_data("SO1", "ALL")
        except HTTPException:
            pass

    domain = execute.call_args.args[2][0]
    assert ("x_studio_cabinet_position", "=", "ALL") not in domain
    assert ("company_id", "=", 5) in domain
    assert execute.call_args.kwargs["context"]["allowed_company_ids"] == [5]


def test_blank_cabinet_position_is_none_not_odoo_false():
    """Odoo sends False for an unset char field; BOMItemResponse wants str or None."""

    def fake_execute(model, method, args, kwargs=None, context=None):
        if model == "sale.order.line":
            return [
                {
                    "id": 1,
                    "product_id": [120756, "[MK-0294] Part"],
                    "x_studio_cabinet_position": False,
                    "product_uom_qty": 1.0,
                }
            ]
        if model == "product.product":
            return [{"id": pid, "product_tmpl_id": [42, "Part"]} for pid in args[0]]
        if model == "mrp.bom":
            return []  # leaf component, no explosion
        raise AssertionError(f"Unexpected Odoo call: {model}.{method}")

    with (
        patch.object(OdooService, "COMPANY_ID", 5),
        patch.object(OdooService, "_execute_kw", side_effect=fake_execute),
    ):
        items = OdooService.fetch_full_bom_data("SO1", "ALL")

    assert items[0]["cabinet_position"] is None
    # The real failure was at serialisation, so assert the schema accepts it.
    assert BOMItemResponse(**items[0]).cabinet_position is None


def _bom_tree_odoo(width=5, depth=3):
    """Fake Odoo serving a complete `width`-ary BOM tree, `depth` levels below the SO.

    A product id encodes its own level as `level * STRIDE + index`, which is all the
    fixture needs to know when to stop handing out BOMs. Template id == product id.
    """
    calls = []
    stride = 1_000_000

    def fake_execute(model, method, args, kwargs=None, context=None):
        calls.append((model, method))
        if model == "sale.order.line":
            return [
                {"id": n, "product_id": [n, f"Part {n}"],
                 "x_studio_cabinet_position": "C1"}
                for n in range(1, width + 1)
            ]
        if model == "product.product":
            return [{"id": pid, "product_tmpl_id": [pid, f"Tmpl {pid}"]} for pid in args[0]]
        if model == "mrp.bom":
            # Only products above the bottom level have anything to explode.
            return [
                {"id": tid, "product_id": False, "product_tmpl_id": [tid, f"Tmpl {tid}"]}
                for tid in args[0][0][2]
                if tid // stride < depth
            ]
        if model == "mrp.bom.line":
            lines = []
            for bom_id in args[0][0][2]:
                level, index = divmod(bom_id, stride)
                for n in range(1, width + 1):
                    child = (level + 1) * stride + index * width + n
                    lines.append({
                        "id": child,
                        "bom_id": [bom_id, f"BOM {bom_id}"],
                        "product_id": [child, f"Child {child}"],
                    })
            return lines
        raise AssertionError(f"Unexpected Odoo call: {model}.{method}")

    return fake_execute, calls


def test_bom_tree_costs_one_round_per_level_not_per_node():
    fake_execute, calls = _bom_tree_odoo(width=5, depth=3)

    with (
        patch.object(OdooService, "COMPANY_ID", 5),
        patch.object(OdooService, "_execute_kw", side_effect=fake_execute),
    ):
        items = OdooService.fetch_full_bom_data("SO1", "ALL")

    def count(node):
        return 1 + sum(count(child) for child in node["children"])

    nodes = sum(count(item) for item in items)
    assert nodes == 5 + 25 + 125 + 625  # the whole tree really was walked
    # Recursive version cost ~3 calls per node. Levels are what we pay for now.
    assert len(calls) < 20, calls


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

    def fake_execute(model, method, args, kwargs=None, context=None):
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

    with (
        patch.object(OdooService, "COMPANY_ID", 5),
        patch.object(OdooService, "_execute_kw", side_effect=fake_execute),
    ):
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
    assert move["company_id"] == 5
    assert created["company_id"] == 5
    assert created["x_studio_sr_poc"] == "Site Lead"


def test_failed_sales_order_lookup_does_not_save_requisite():
    db = MagicMock()
    data = SimpleNamespace(sales_order="S00884")

    with patch.object(
        OdooService,
        "get_sales_order_details",
        side_effect=HTTPException(status_code=404, detail="not found"),
    ):
        try:
            RequisiteService.submit_site_requisite(db, data)
        except HTTPException as exc:
            assert exc.status_code == 404
        else:
            raise AssertionError("Sales-order lookup failure was swallowed")

    db.add.assert_not_called()


def test_repair_order_sync_key_reuses_existing_order():
    with patch.object(
        OdooService,
        "_execute_kw",
        return_value=[{"id": 544, "name": "WH/RO/00482"}],
    ) as execute:
        result = OdooService.create_repair_order_for_requisite(
            sales_order="S01716",
            cabinet_position="C1",
            sr_poc="Site Lead",
            repair_reference=None,
            expected_delivery=None,
            do_number=None,
            items=[],
            sync_key="site-requisite-test",
        )

    assert result == {"id": 544, "name": "WH/RO/00482"}
    assert execute.call_count == 1


def test_repair_order_states_are_returned_without_local_mapping():
    with patch.object(
        OdooService,
        "_execute_kw",
        return_value=[{"id": 544, "state": "under_repair"}],
    ):
        states = OdooService.get_repair_order_states([544, 544])

    assert states == {544: "under_repair"}


if __name__ == "__main__":
    test_all_cabinets_omits_position_filter()
    test_repair_order_notes_escape_user_text()
    test_repair_order_create_payload_has_part_lines()
    test_failed_sales_order_lookup_does_not_save_requisite()
