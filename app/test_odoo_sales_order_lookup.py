from unittest.mock import patch

from app.services.odoo_service import OdooService


def test_sales_order_details_use_the_selected_company():
    calls = []

    def fake_execute(model, method, args, kwargs=None, context=None):
        calls.append((model, method, args, kwargs, context))
        if model == "sale.order":
            return [
                {
                    "name": "S00311",
                    "company_id": [9, "Other Company"],
                    "partner_id": [21, "Customer"],
                    "partner_shipping_id": [21, "Customer"],
                    "client_order_ref": "REF-9",
                    "x_studio_project_name": False,
                    "amount_total": 1000,
                    "state": "sale",
                }
            ]
        if model == "res.partner":
            return [
                {
                    "id": 21,
                    "name": "Customer",
                    "phone": "9876543210",
                    "mobile": False,
                    "email": False,
                    "street": "Site address",
                    "street2": False,
                    "city": "Mumbai",
                    "zip": "400001",
                    "state_id": [1, "Maharashtra (IN)"],
                    "country_id": [104, "India"],
                    "parent_id": False,
                    "commercial_partner_id": [21, "Customer"],
                }
            ]
        raise AssertionError(f"Unexpected Odoo call: {model}.{method}")

    with patch.object(OdooService, "_execute_kw", side_effect=fake_execute):
        result = OdooService.get_sales_order_details("S00311", company_id=9)

    sale_order_call, partner_call = calls
    assert ("company_id", "=", 9) in sale_order_call[2][0]
    assert sale_order_call[4] == {"allowed_company_ids": [9], "company_id": 9}
    assert partner_call[4] == {"allowed_company_ids": [9], "company_id": 9}
    assert result["customer_name"] == "Customer"
    assert result["city"] == "Mumbai"
