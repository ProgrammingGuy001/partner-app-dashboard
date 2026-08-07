import logging
import ssl
import threading
import xmlrpc.client  # nosec B411  — monkey-patched below via defusedxml
from html import escape
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urlparse

import defusedxml.xmlrpc
from fastapi import HTTPException

from app.config import settings

# Patch xmlrpc.client to prevent XML bomb / entity expansion attacks
defusedxml.xmlrpc.monkey_patch()

logger = logging.getLogger(__name__)


class TimeoutTransport(xmlrpc.client.Transport):
    """XML-RPC transport with a bounded socket timeout."""

    def __init__(self, *, timeout: int):
        super().__init__()
        self.timeout = timeout

    def make_connection(self, host):
        connection = super().make_connection(host)
        connection.timeout = self.timeout
        return connection


class TimeoutSafeTransport(xmlrpc.client.SafeTransport):
    """HTTPS XML-RPC transport with TLS context and bounded socket timeout."""

    def __init__(self, *, timeout: int, context: ssl.SSLContext):
        super().__init__(context=context)
        self.timeout = timeout

    def make_connection(self, host):
        connection = super().make_connection(host)
        connection.timeout = self.timeout
        return connection


def _build_odoo_ssl_context() -> ssl.SSLContext:
    """Build SSL context for Odoo XML-RPC requests."""
    if getattr(settings, "ODOO_SSL_VERIFY", "true").lower() == "false":
        return ssl._create_unverified_context()  # noqa: S323

    try:
        import certifi

        # Use certifi CA bundle for consistent TLS validation across environments.
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        logger.warning(
            "certifi CA bundle unavailable; falling back to system trust store for Odoo SSL"
        )
        return ssl.create_default_context()


def _build_odoo_transport(url: str | None, context: ssl.SSLContext):
    timeout = max(1, settings.ODOO_RPC_TIMEOUT_SECONDS)
    if urlparse(url or "").scheme == "https":
        return TimeoutSafeTransport(timeout=timeout, context=context)
    return TimeoutTransport(timeout=timeout)


class OdooService:
    """Service class for interacting with Odoo XML-RPC API"""

    # Odoo connection settings from environment
    URL = settings.ODOO_URL
    DB = settings.ODOO_DB
    USERNAME = settings.ODOO_USERNAME
    PASSWORD = settings.ODOO_PASSWORD
    COMPANY_ID = settings.ODOO_COMPANY_ID
    REPAIR_ORDER_SALE_FIELD = "x_studio_many2one_field_3d_1j5irl101"
    PURCHASE_SERVICE_PRODUCTS = {
        "b2b": "B2B Installation Service",
        "b2c": "B2C Installation Service",
    }

    # Per-thread connection state. xmlrpc ServerProxy is not thread-safe and FastAPI
    # runs sync endpoints in a threadpool, so each thread gets its own connection.
    _local = threading.local()

    # Use verified SSL by default. Set ODOO_SSL_VERIFY=false only in dev.
    _ssl_context = _build_odoo_ssl_context()

    @classmethod
    def _initialize_connection(cls, force: bool = False):
        """Initialize Odoo connection if not already initialized or if forced"""
        # Define invalid or missing values
        invalid_values = (None, "", "None", "none", "null")

        # Check if Odoo configuration is available
        if any(val in invalid_values for val in [cls.URL, cls.DB, cls.USERNAME, cls.PASSWORD]):
            missing = []
            if cls.URL in invalid_values:
                missing.append("ODOO_URL")
            if cls.DB in invalid_values:
                missing.append("ODOO_DB")
            if cls.USERNAME in invalid_values:
                missing.append("ODOO_USERNAME")
            if cls.PASSWORD in invalid_values:
                missing.append("ODOO_PASSWORD")
            logger.error("Odoo configuration incomplete. Missing: %s", ", ".join(missing))
            raise HTTPException(
                status_code=503,
                detail=f"Odoo service not configured. Missing: {', '.join(missing)}"
            )

        local = cls._local
        if force or getattr(local, "uid", None) is None:
            try:
                logger.info("Connecting to Odoo: %s (db=%s, user=%s)", cls.URL, cls.DB, cls.USERNAME)
                local.common = xmlrpc.client.ServerProxy(
                    f'{cls.URL}/xmlrpc/2/common',
                    transport=_build_odoo_transport(cls.URL, cls._ssl_context),
                    allow_none=True,
                )
                local.uid = local.common.authenticate(cls.DB, cls.USERNAME, cls.PASSWORD, {})
                local.models = xmlrpc.client.ServerProxy(
                    f'{cls.URL}/xmlrpc/2/object',
                    transport=_build_odoo_transport(cls.URL, cls._ssl_context),
                    allow_none=True,
                )

                if not local.uid:
                    logger.error("Odoo authentication failed - invalid credentials")
                    raise HTTPException(
                        status_code=401,
                        detail="Failed to authenticate with Odoo - check credentials"
                    )
                logger.info("Odoo connection successful (uid=%s)", local.uid)
            except HTTPException:
                raise
            except Exception as e:
                logger.error(
                    "Failed to initialize Odoo connection (url=%s db=%s user=%s): %s",
                    cls.URL,
                    cls.DB,
                    cls.USERNAME,
                    e,
                    exc_info=True,
                )
                raise HTTPException(
                    status_code=500,
                    detail="Odoo service unavailable. Try again shortly.",
                ) from e

    @classmethod
    def _execute_kw(
        cls,
        model: str,
        method: str,
        args: List,
        kwargs: Dict = None,
        context: Dict = None,
    ) -> Any:
        """Execute Odoo XML-RPC method with error handling and retry mechanism"""
        cls._initialize_connection()
        local = cls._local
        if kwargs is None:
            kwargs = {}
        if context:
            kwargs = {**kwargs, 'context': {**kwargs.get('context', {}), **context}}

        try:
            return local.models.execute_kw(
                cls.DB, local.uid, cls.PASSWORD,
                model, method, args, kwargs
            )
        except (xmlrpc.client.ProtocolError, OSError, ConnectionError) as net_err:
            # Network or protocol failures (e.g., dropped connection, session timeout)
            logger.warning("Odoo connection dropped, attempting reconnect... Error: %s", net_err)
            if method in {"create", "action_create_invoice"}:
                raise HTTPException(
                    status_code=502,
                    detail="Odoo write result is unknown; retry through the approval endpoint",
                ) from net_err
            try:
                cls._initialize_connection(force=True)
                return local.models.execute_kw(
                    cls.DB, local.uid, cls.PASSWORD,
                    model, method, args, kwargs
                )
            except Exception as retry_err:
                logger.error("Odoo execute_kw retry failed: %s", retry_err)
                raise HTTPException(
                    status_code=500,
                    detail="Error executing Odoo method after reconnect attempt",
                ) from retry_err
        except xmlrpc.client.Fault as e:
            logger.error("Odoo XML-RPC fault: %s", e.faultString)
            raise HTTPException(
                status_code=500,
                detail="Odoo service error",
            ) from e
        except Exception as e:
            logger.error("Odoo execute_kw generic error: %s", e)
            raise HTTPException(
                status_code=500,
                detail="Error executing Odoo method",
            ) from e

    @classmethod
    def _company_domain(cls, company_id: Optional[int] = None) -> tuple:
        """Company filter for Odoo domains. Falls back to the configured default."""
        return ('company_id', '=', company_id or cls.COMPANY_ID)

    @classmethod
    def _company_context(cls, company_id: Optional[int] = None) -> Dict[str, Any]:
        """RPC context so reads and writes happen inside the given company."""
        resolved = company_id or cls.COMPANY_ID
        return {'allowed_company_ids': [resolved], 'company_id': resolved}

    @classmethod
    def find_sales_orders(cls, sales_order: str) -> List[Dict[str, Any]]:
        """
        Find every sale.order with this name, across all companies the RPC user
        can see. SO names are not unique in this database (a name can appear in
        up to 10 companies), so callers disambiguate on company_id.
        """
        orders = cls._execute_kw(
            'sale.order',
            'search_read',
            [[('name', '=', sales_order)]],
            {'fields': ['id', 'name', 'company_id', 'partner_id', 'state'], 'order': 'company_id'},
        )
        return [
            {
                'sale_order_id': order['id'],
                'name': order.get('name') or '',
                'company_id': cls.safe_extract_id(order.get('company_id')) or None,
                'company_name': (order.get('company_id') or [None, ''])[1] if order.get('company_id') else '',
                'customer_name': (order.get('partner_id') or [None, ''])[1] if order.get('partner_id') else '',
                'state': order.get('state') or '',
            }
            for order in orders
        ]

    @staticmethod
    def safe_extract_id(m2o_value: Any) -> Optional[int]:
        """
        Safely extract integer ID from Many2one field.

        Args:
            m2o_value: Many2one field value from Odoo (typically [id, name] or False)

        Returns:
            Integer ID or False if not found
        """
        if not m2o_value or m2o_value == [False, False]:
            return False
        if isinstance(m2o_value, list) and len(m2o_value) >= 1:
            id_val = m2o_value[0]
            if isinstance(id_val, int):
                return id_val
        return False

    @staticmethod
    def extract_product_name(product_field: Any) -> str:
        """
        Extract clean product name from Odoo Many2one field [id, name].

        Args:
            product_field: Product Many2one field from Odoo

        Returns:
            Clean product name without ID prefix
        """
        if not product_field or product_field == [False, False]:
            return "Unknown Product"
        if isinstance(product_field, list) and len(product_field) >= 2:
            return product_field[1]  # The name is at index 1
        return "Unknown Product"

    # Depth 0 is the sale order line's own components; deeper than this is a modelling
    # mistake, not a real assembly.
    MAX_BOM_DEPTH = 10

    @classmethod
    def _template_ids(cls, product_ids: Set[int]) -> Dict[int, int]:
        """{product_id: product_tmpl_id} for a whole level of the tree in one read."""
        ids = sorted(pid for pid in product_ids if pid)
        if not ids:
            return {}
        rows = cls._execute_kw(
            'product.product', 'read', [ids], {'fields': ['product_tmpl_id']}
        )
        return {row['id']: cls.safe_extract_id(row.get('product_tmpl_id')) for row in rows}

    @classmethod
    def _expand_bom_level(cls, frontier: List[tuple], depth: int) -> List[tuple]:
        """Attach one level of components to every node in `frontier`, in 3 RPCs.

        Each frontier entry is (component dict, product_id, product_tmpl_id, ids of the
        BOMs already on this node's path). Returns the next level's frontier.
        """
        template_ids = sorted({tmpl for _, _, tmpl, _ in frontier if tmpl})
        if not template_ids:
            return []

        # A variant's BOM always belongs to that variant's template, so searching on the
        # template alone finds everything the old per-product search did.
        boms = cls._execute_kw(
            'mrp.bom',
            'search_read',
            [[('product_tmpl_id', 'in', template_ids), cls._company_domain()]],
            {'fields': ['id', 'product_id', 'product_tmpl_id']},
            context=cls._company_context(),
        )
        boms_by_template: Dict[int, List[Dict[str, Any]]] = {}
        for bom in boms:
            key = cls.safe_extract_id(bom.get('product_tmpl_id'))
            boms_by_template.setdefault(key, []).append(bom)

        def bom_for(product_id: int, template_id: int) -> Optional[Dict[str, Any]]:
            candidates = boms_by_template.get(template_id, [])
            # This variant's own BOM wins, else the template-wide one. A sibling
            # variant's BOM is never a match — the old `limit=1` search could return one.
            for bom in candidates:
                if cls.safe_extract_id(bom.get('product_id')) == product_id:
                    return bom
            for bom in candidates:
                if not bom.get('product_id'):
                    return bom
            return None

        pending = []
        for component, product_id, template_id, visited in frontier:
            bom = bom_for(product_id, template_id)
            # A BOM already on this path is a cycle; leave the node childless.
            if bom and bom['id'] not in visited:
                pending.append((component, bom['id'], visited | {bom['id']}))
        if not pending:
            return []

        bom_lines = cls._execute_kw(
            'mrp.bom.line',
            'search_read',
            [[
                ('bom_id', 'in', sorted({bom_id for _, bom_id, _ in pending})),
                cls._company_domain(),
            ]],
            {'fields': ['id', 'product_id', 'bom_id']},
            context=cls._company_context(),
        )
        lines_by_bom: Dict[int, List[Dict[str, Any]]] = {}
        for line in bom_lines:
            lines_by_bom.setdefault(cls.safe_extract_id(line.get('bom_id')), []).append(line)

        templates = cls._template_ids(
            {cls.safe_extract_id(line.get('product_id')) for line in bom_lines}
        )

        next_frontier = []
        for component, bom_id, visited in pending:
            for line in lines_by_bom.get(bom_id, []):
                product_id = cls.safe_extract_id(line.get('product_id'))
                template_id = templates.get(product_id)
                if not template_id:
                    continue
                child = {
                    'product_name': cls.extract_product_name(line.get('product_id')),
                    'depth': depth,
                    'children': [],
                }
                component['children'].append(child)
                next_frontier.append((child, product_id, template_id, visited))

        logger.debug("BOM depth %d: %d nodes expanded into %d children",
                     depth, len(pending), len(next_frontier))
        return next_frontier

    @classmethod
    def fetch_full_bom_data(cls, sales_order: str, cabinet_position: str) -> List[Dict[str, Any]]:
        """
        Fetch complete BOM hierarchy from Odoo for a given sales order and cabinet position.

        Walks the tree breadth-first, one RPC round per level rather than three per node:
        Odoo's search_read is cheap per record and expensive per round trip.

        Args:
            sales_order: Sales order number
            cabinet_position: Cabinet position identifier

        Returns:
            List of BOM items with nested children hierarchy

        Raises:
            HTTPException: If no BOM items found or Odoo error occurs
        """
        is_all_cabinets = cabinet_position.strip().lower() in {"all", "all cabinets", "*"}
        domain = [
            ('order_id.name', '=', sales_order),
            cls._company_domain(),
        ]
        if not is_all_cabinets:
            domain.append(('x_studio_cabinet_position', '=', cabinet_position))

        # Fetch sale.order.line items
        sale_lines = cls._execute_kw(
            'sale.order.line',
            'search_read',
            [domain],
            {'fields': ['id', 'product_id', 'x_studio_cabinet_position']},
            context=cls._company_context(),
        )

        if not sale_lines:
            target = f"sales order '{sales_order}'"
            if not is_all_cabinets:
                target += f" and cabinet position '{cabinet_position}'"
            raise HTTPException(
                status_code=404,
                detail=f"No BOM items found for {target}"
            )

        templates = cls._template_ids(
            {cls.safe_extract_id(line.get('product_id')) for line in sale_lines}
        )

        processed_items = []
        frontier = []
        for line in sale_lines:
            product_id = cls.safe_extract_id(line.get('product_id'))
            template_id = templates.get(product_id)
            if not template_id:
                continue

            item = {
                'product_name': cls.extract_product_name(line.get('product_id')),
                # Odoo returns False, not None, for an unset char field, and False is
                # not a str — it fails response validation.
                'cabinet_position': line.get('x_studio_cabinet_position') or None,
                'depth': 0,
                'children': [],
            }
            processed_items.append(item)
            frontier.append((item, product_id, template_id, frozenset()))

        for depth in range(cls.MAX_BOM_DEPTH + 1):
            if not frontier:
                break
            frontier = cls._expand_bom_level(frontier, depth)

        return processed_items

    @staticmethod
    def _repair_order_notes(
        *,
        sales_order: str,
        cabinet_position: str,
        sr_poc: str | None,
        repair_reference: str | None,
        expected_delivery: Any,
        do_number: str | None,
        items: List[Any],
        sync_key: str | None = None,
    ) -> str:
        meta = [
            ("Sales Order", sales_order),
            ("Cabinet Position", cabinet_position),
            ("SR POC", sr_poc),
            ("Repair Reference", repair_reference),
            ("Expected Delivery", expected_delivery),
            ("DO Number", do_number),
            ("Site Requisite Key", sync_key),
        ]
        rows = "".join(
            "<tr>"
            f"<td>{escape(str(getattr(item, 'product_name', '')))}</td>"
            f"<td>{escape(str(getattr(item, 'quantity', '') or ''))}</td>"
            f"<td>{escape(str(getattr(item, 'component_status', '') or ''))}</td>"
            f"<td>{escape(str(getattr(item, 'responsible_department', '') or ''))}</td>"
            f"<td>{escape(str(getattr(item, 'issue_description', '') or ''))}</td>"
            "</tr>"
            for item in items
        )
        meta_html = "".join(
            f"<li><b>{label}:</b> {escape(str(value))}</li>"
            for label, value in meta
            if value
        )
        return (
            "<p><b>Site Requisite</b></p>"
            f"<ul>{meta_html}</ul>"
            "<table border='1' cellpadding='4' cellspacing='0'>"
            "<thead><tr><th>Product</th><th>Qty</th><th>Status</th><th>Department</th><th>Issue</th></tr></thead>"
            f"<tbody>{rows}</tbody></table>"
        )

    @classmethod
    def _repair_order_part_moves(cls, items: List[Any], values: Dict[str, Any]) -> List[tuple]:
        for field in ('location_id', 'location_dest_id'):
            if not values.get(field):
                raise HTTPException(status_code=422, detail=f"Repair order missing {field}")

        company_id = values.get('company_id') or cls.COMPANY_ID
        company_context = cls._company_context(company_id)
        moves = []
        for item in items:
            product_name = (getattr(item, 'product_name', '') or '').strip()
            if not product_name:
                continue

            matches = cls._execute_kw(
                'product.product',
                'name_search',
                [product_name],
                {'operator': 'ilike', 'limit': 1},
                context=company_context,
            )
            product_id = cls.safe_extract_id(matches[0]) if matches else None
            if not product_id:
                raise HTTPException(status_code=404, detail=f"Odoo product not found: {product_name}")

            products = cls._execute_kw(
                'product.product',
                'read',
                [[product_id]],
                {'fields': ['uom_id']},
                context=company_context,
            )
            uom_id = cls.safe_extract_id(products[0].get('uom_id')) if products else None
            if not uom_id:
                raise HTTPException(status_code=422, detail=f"Odoo product has no UoM: {product_name}")

            issue = (getattr(item, 'issue_description', '') or '').strip()
            move = {
                'name': product_name,
                'product_id': product_id,
                'product_uom_qty': float(getattr(item, 'quantity', None) or 1),
                'product_uom': uom_id,
                'repair_line_type': 'add',
                'location_id': values['location_id'],
                'location_dest_id': values['location_dest_id'],
                'company_id': company_id,
            }
            if values.get('picking_type_id'):
                move['picking_type_id'] = values['picking_type_id']
            if values.get('schedule_date'):
                move['date'] = values['schedule_date']
            if issue:
                move['description_picking'] = issue
                move['x_studio_description'] = issue
            moves.append((0, 0, move))

        if items and not moves:
            raise HTTPException(status_code=422, detail="No repair order line items to create")
        return moves

    @classmethod
    def create_repair_order_for_requisite(
        cls,
        *,
        sales_order: str,
        cabinet_position: str,
        sr_poc: str | None,
        repair_reference: str | None,
        expected_delivery: Any,
        do_number: str | None,
        items: List[Any],
        sync_key: str | None = None,
    ) -> Dict[str, Any]:
        company_context = cls._company_context()
        if sync_key:
            existing = cls._execute_kw(
                'repair.order',
                'search_read',
                [[('internal_notes', 'ilike', f"Site Requisite Key:</b> {sync_key}")]],
                {'fields': ['id', 'name'], 'limit': 1},
            )
            if existing:
                return {'id': existing[0]['id'], 'name': existing[0].get('name', '')}

        orders = cls._execute_kw(
            'sale.order',
            'search_read',
            [[('name', '=', sales_order), cls._company_domain()]],
            {'fields': ['id', 'partner_id'], 'limit': 1},
            context=company_context,
        )
        if not orders:
            raise HTTPException(status_code=404, detail=f"Sales order '{sales_order}' not found in Odoo")

        defaults = cls._execute_kw(
            'repair.order',
            'default_get',
            [[
                'company_id', 'picking_type_id', 'schedule_date', 'location_id',
                'location_dest_id', 'parts_location_id', 'recycle_location_id',
            ]],
            context=company_context,
        )
        values = {key: value for key, value in defaults.items() if value}
        values['company_id'] = cls.COMPANY_ID
        values[cls.REPAIR_ORDER_SALE_FIELD] = orders[0]['id']
        if sr_poc:
            values['x_studio_sr_poc'] = sr_poc

        partner_id = cls.safe_extract_id(orders[0].get('partner_id'))
        if partner_id:
            values['partner_id'] = partner_id

        if expected_delivery:
            values['schedule_date'] = f"{expected_delivery} 00:00:00"

        picking_type_id = cls.safe_extract_id(values.get('picking_type_id')) or values.get('picking_type_id')
        if picking_type_id:
            picking_type = cls._execute_kw(
                'stock.picking.type',
                'read',
                [[picking_type_id]],
                {'fields': ['default_location_src_id', 'default_location_dest_id']},
                context=company_context,
            )
            if picking_type:
                src_id = cls.safe_extract_id(picking_type[0].get('default_location_src_id'))
                dest_id = cls.safe_extract_id(picking_type[0].get('default_location_dest_id'))
                if src_id:
                    values.setdefault('location_id', src_id)
                    values.setdefault('recycle_location_id', src_id)
                if dest_id:
                    values.setdefault('location_dest_id', dest_id)

        if 'parts_location_id' not in values:
            scrap_locations = cls._execute_kw(
                'stock.location',
                'search_read',
                [[('scrap_location', '=', True), ('company_id', 'in', [cls.COMPANY_ID, False])]],
                {'fields': ['id'], 'limit': 1},
                context=company_context,
            )
            if scrap_locations:
                values['parts_location_id'] = scrap_locations[0]['id']

        values['internal_notes'] = cls._repair_order_notes(
            sales_order=sales_order,
            cabinet_position=cabinet_position,
            sr_poc=sr_poc,
            repair_reference=repair_reference,
            expected_delivery=expected_delivery,
            do_number=do_number,
            items=items,
            sync_key=sync_key,
        )
        values['move_ids'] = cls._repair_order_part_moves(items, values)

        repair_id = cls._execute_kw('repair.order', 'create', [values], context=company_context)
        repair = cls._execute_kw(
            'repair.order',
            'read',
            [[repair_id]],
            {'fields': ['name']},
            context=company_context,
        )
        return {'id': repair_id, 'name': repair[0].get('name') if repair else ''}

    @classmethod
    def get_repair_order_states(cls, repair_order_ids: List[int]) -> Dict[int, str]:
        ids = sorted(set(repair_order_ids))
        if not ids:
            return {}
        orders = cls._execute_kw(
            'repair.order',
            'read',
            [ids],
            {'fields': ['state']},
        )
        return {order['id']: order.get('state', '') for order in orders}

    @classmethod
    def search_purchase_vendors(cls, search: str, limit: int = 20) -> List[Dict[str, Any]]:
        term = search.strip()
        if len(term) < 2:
            return []
        return cls._execute_kw(
            "res.partner",
            "search_read",
            [[
                ("active", "=", True),
                ("supplier_rank", ">", 0),
                ("name", "ilike", term),
            ]],
            {"fields": ["id", "name"], "limit": limit, "order": "name"},
        )

    @classmethod
    def get_purchase_vendor(cls, vendor_id: int) -> Dict[str, Any]:
        vendors = cls._execute_kw(
            "res.partner",
            "search_read",
            [[
                ("id", "=", vendor_id),
                ("active", "=", True),
                ("supplier_rank", ">", 0),
            ]],
            {"fields": ["id", "name"], "limit": 1},
        )
        if not vendors:
            raise HTTPException(status_code=422, detail="Selected Odoo vendor is not active or purchasable")
        return vendors[0]

    @classmethod
    def create_installation_service_rfq(
        cls,
        *,
        vendor_id: int,
        sales_order: str | None,
        poc_name: str | None,
        service_type: str,
        quantity: float,
        unit_price: float,
        sync_key: str,
    ) -> Dict[str, Any]:
        sales_order = (sales_order or "").strip()
        poc_name = (poc_name or "").strip()
        if not sales_order or not poc_name:
            raise HTTPException(status_code=422, detail="SO and POC name are required")

        product_name = cls.PURCHASE_SERVICE_PRODUCTS.get(service_type)
        if not product_name:
            raise HTTPException(status_code=422, detail="Invalid installation service type")

        existing = cls._execute_kw(
            "purchase.order",
            "search_read",
            [[("origin", "=", sync_key)]],
            {"fields": ["id"], "limit": 2},
        )
        if len(existing) > 1:
            raise HTTPException(status_code=409, detail="Multiple Odoo RFQs share this request key")

        vendor = cls.get_purchase_vendor(vendor_id)
        products = cls._execute_kw(
            "product.product",
            "search_read",
            [[
                ("name", "=", product_name),
                ("active", "=", True),
                ("purchase_ok", "=", True),
            ]],
            {"fields": ["id", "name", "uom_po_id"], "limit": 2},
        )
        if len(products) != 1:
            raise HTTPException(status_code=422, detail=f"Odoo must contain exactly one active '{product_name}' product")

        product = products[0]
        product_uom = cls.safe_extract_id(product.get("uom_po_id"))
        if not product_uom:
            raise HTTPException(status_code=422, detail=f"Odoo product '{product_name}' has no purchase unit of measure")

        order_id = existing[0]["id"] if existing else cls._execute_kw(
            "purchase.order",
            "create",
            [{
                "partner_id": vendor["id"],
                "origin": sync_key,
                "x_studio_poc": poc_name,
                "order_line": [(0, 0, {
                    "product_id": product["id"],
                    "name": product["name"],
                    "product_qty": quantity,
                    "product_uom": product_uom,
                    "price_unit": unit_price,
                    "x_studio_so_no": sales_order,
                })],
            }],
        )

        orders = cls._execute_kw(
            "purchase.order",
            "read",
            [[order_id]],
            {"fields": ["id", "name", "state", "partner_id", "origin", "x_studio_poc", "order_line"]},
        )
        if not orders:
            raise HTTPException(status_code=502, detail="Created Odoo RFQ could not be read back")
        order = orders[0]
        lines = cls._execute_kw(
            "purchase.order.line",
            "read",
            [order.get("order_line") or []],
            {"fields": ["product_id", "product_qty", "product_uom", "price_unit", "x_studio_so_no"]},
        )
        line = lines[0] if len(lines) == 1 else None
        if (
            order.get("state") != "draft"
            or cls.safe_extract_id(order.get("partner_id")) != vendor_id
            or order.get("origin") != sync_key
            or order.get("x_studio_poc") != poc_name
            or not line
            or cls.safe_extract_id(line.get("product_id")) != product["id"]
            or cls.safe_extract_id(line.get("product_uom")) != product_uom
            or abs(float(line.get("product_qty") or 0) - quantity) > 0.001
            or abs(float(line.get("price_unit") or 0) - unit_price) > 0.001
            or line.get("x_studio_so_no") != sales_order
        ):
            raise HTTPException(status_code=502, detail="Odoo RFQ read-back did not match the approved request")

        return {"id": order["id"], "name": order.get("name", ""), "state": order["state"]}

    @classmethod
    def get_purchase_order_billing_statuses(cls, order_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        ids = sorted(set(order_ids))
        if not ids:
            return {}

        orders = cls._execute_kw(
            "purchase.order",
            "read",
            [ids],
            {"fields": ["name", "state", "invoice_status", "invoice_ids"]},
        )
        bill_ids = sorted({bill_id for order in orders for bill_id in order.get("invoice_ids") or []})
        bills = cls._execute_kw(
            "account.move",
            "read",
            [bill_ids],
            {"fields": ["name", "state", "move_type"]},
        ) if bill_ids else []
        bills_by_id = {bill["id"]: bill for bill in bills if bill.get("move_type") == "in_invoice"}

        statuses = {}
        for order in orders:
            bill = next(
                (bills_by_id[bill_id] for bill_id in reversed(order.get("invoice_ids") or []) if bill_id in bills_by_id),
                None,
            )
            statuses[order["id"]] = {
                "name": order.get("name", ""),
                "state": order.get("state", ""),
                "invoice_status": order.get("invoice_status", ""),
                "vendor_bill_id": bill.get("id") if bill else None,
                "vendor_bill_name": bill.get("name") if bill else None,
                "vendor_bill_state": bill.get("state") if bill else None,
            }
        return statuses

    @classmethod
    def get_purchase_order_billing_status(cls, order_id: int) -> Dict[str, Any]:
        status = cls.get_purchase_order_billing_statuses([order_id]).get(order_id)
        if not status:
            raise HTTPException(status_code=404, detail="Odoo purchase order not found")
        return status

    @classmethod
    def create_vendor_bill_from_purchase_order(cls, order_id: int) -> Dict[str, Any]:
        status = cls.get_purchase_order_billing_status(order_id)
        if status["vendor_bill_id"]:
            return status
        if status["state"] not in {"purchase", "done"}:
            raise HTTPException(status_code=409, detail="Confirm the RFQ as a purchase order in Odoo first")
        if status["invoice_status"] != "to invoice":
            raise HTTPException(status_code=409, detail="This Odoo purchase order has nothing available to bill")

        cls._execute_kw("purchase.order", "action_create_invoice", [[order_id]])
        created = cls.get_purchase_order_billing_status(order_id)
        if not created["vendor_bill_id"]:
            raise HTTPException(status_code=502, detail="Odoo did not return the created vendor bill")
        return created

    @classmethod
    def get_sales_order_details(cls, sales_order: str) -> Dict[str, Any]:
        """
        Fetch customer and project details from a Sales Order number.
        Used to auto-populate job creation forms.

        Args:
            sales_order: Sales order number (e.g. 'S00311')

        Returns:
            Dictionary with customer_name, phone, address, city, pincode,
            state, project_name, client_order_ref

        Raises:
            HTTPException: If sales order not found
        """
        # Fetch the sales order
        orders = cls._execute_kw(
            'sale.order',
            'search_read',
            [[('name', '=', sales_order), cls._company_domain()]],
            {
                'fields': [
                    'name', 'partner_id', 'partner_shipping_id',
                    'client_order_ref', 'x_studio_project_name',
                    'amount_total', 'state',
                ],
                'limit': 1,
            },
            context=cls._company_context(),
        )

        if not orders:
            raise HTTPException(
                status_code=404,
                detail=f"Sales order '{sales_order}' not found in Odoo"
            )

        order = orders[0]

        # Use shipping address (delivery address) if available, else billing partner
        shipping_partner_id = cls.safe_extract_id(order.get('partner_shipping_id'))
        billing_partner_id = cls.safe_extract_id(order.get('partner_id'))

        result = {
            'sales_order': order.get('name'),
            'client_order_ref': order.get('client_order_ref') or '',
            'amount_total': order.get('amount_total', 0),
            'order_state': order.get('state', ''),
            'customer_name': '',
            'phone': '',
            'email': '',
            'address_line_1': '',
            'address_line_2': '',
            'city': '',
            'pincode': '',
            'state': '',
            'project_name': '',
        }

        # Extract project name from custom Studio field
        project_field = order.get('x_studio_project_name')
        if project_field and isinstance(project_field, list) and len(project_field) >= 2:
            result['project_name'] = project_field[1]

        # Fetch partner (customer) details.
        # The shipping id often resolves to a delivery-type child contact whose own
        # address/phone fields are empty (the data lives on the parent / commercial
        # partner). So read BOTH shipping and billing contacts and fall back field by
        # field, then gap-fill from the commercial/parent partner if still empty.
        partner_fields = [
            'name', 'phone', 'mobile', 'email',
            'street', 'street2', 'city', 'zip',
            'state_id', 'country_id', 'parent_id', 'commercial_partner_id',
        ]

        partner_ids = [pid for pid in dict.fromkeys([shipping_partner_id, billing_partner_id]) if pid]
        if partner_ids:
            records = cls._execute_kw(
                'res.partner',
                'read',
                [partner_ids],
                {'fields': partner_fields},
                context=cls._company_context(),
            )
            partners = {p['id']: p for p in records}
            ship = partners.get(shipping_partner_id, {})
            bill = partners.get(billing_partner_id, {})

            def pick(field: str) -> str:
                return ship.get(field) or bill.get(field) or ''

            def extract_state(state_field: Any) -> str:
                if state_field and isinstance(state_field, list) and len(state_field) >= 2:
                    state_name = state_field[1]
                    # Remove country suffix like " (IN)"
                    if ' (' in state_name:
                        state_name = state_name.split(' (')[0]
                    return state_name
                return ''

            result['customer_name'] = pick('name')
            result['phone'] = (
                ship.get('phone') or ship.get('mobile')
                or bill.get('phone') or bill.get('mobile') or ''
            )
            result['email'] = pick('email')
            result['address_line_1'] = pick('street')
            result['address_line_2'] = pick('street2')
            result['city'] = pick('city')
            result['pincode'] = pick('zip')
            result['state'] = extract_state(ship.get('state_id') or bill.get('state_id'))

            # Gap-fill from the commercial / parent partner if address is still empty
            if not result['address_line_1']:
                parent_id = cls.safe_extract_id(
                    ship.get('commercial_partner_id') or ship.get('parent_id')
                    or bill.get('commercial_partner_id') or bill.get('parent_id')
                )
                if parent_id and parent_id not in (shipping_partner_id, billing_partner_id):
                    parents = cls._execute_kw(
                        'res.partner',
                        'read',
                        [[parent_id]],
                        {'fields': partner_fields},
                        context=cls._company_context(),
                    )
                    if parents:
                        parent = parents[0]
                        result['address_line_1'] = result['address_line_1'] or parent.get('street') or ''
                        result['address_line_2'] = result['address_line_2'] or parent.get('street2') or ''
                        result['city'] = result['city'] or parent.get('city') or ''
                        result['pincode'] = result['pincode'] or parent.get('zip') or ''
                        result['phone'] = result['phone'] or parent.get('phone') or parent.get('mobile') or ''
                        result['email'] = result['email'] or parent.get('email') or ''
                        result['customer_name'] = result['customer_name'] or parent.get('name') or ''
                        if not result['state']:
                            result['state'] = extract_state(parent.get('state_id'))

        return result

    @classmethod
    def validate_sales_order(cls, sales_order: str) -> bool:
        """
        Validate if a sales order exists in Odoo.

        Args:
            sales_order: Sales order number to validate

        Returns:
            True if sales order exists, False otherwise
        """
        try:
            result = cls._execute_kw(
                'sale.order',
                'search',
                [[('name', '=', sales_order), cls._company_domain()]],
                {'limit': 1},
                context=cls._company_context(),
            )
            return bool(result)
        except Exception as e:
            logger.error("Failed to validate sales order: %s", e)
            return False

    @classmethod
    def get_cabinet_positions(cls, sales_order: str) -> List[str]:
        """
        Get all available cabinet positions for a sales order.

        Args:
            sales_order: Sales order number

        Returns:
            List of cabinet position identifiers
        """
        try:
            sale_lines = cls._execute_kw(
                'sale.order.line',
                'search_read',
                [[('order_id.name', '=', sales_order), cls._company_domain()]],
                {'fields': ['x_studio_cabinet_position']},
                context=cls._company_context(),
            )

            # Extract unique cabinet positions
            positions = set()
            for line in sale_lines:
                position = line.get('x_studio_cabinet_position')
                if position:
                    positions.add(position)

            return sorted(list(positions))
        except Exception as e:
            logger.error("Failed to fetch cabinet positions: %s", e)
            return []

    @classmethod
    def get_product_details(cls, product_id: int) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a product.

        Args:
            product_id: Product ID

        Returns:
            Dictionary with product details or None if not found
        """
        try:
            products = cls._execute_kw(
                'product.product',
                'read',
                [[product_id]],
                {
                    'fields': [
                        'name', 'default_code', 'type', 'uom_id',
                        'list_price', 'standard_price', 'categ_id'
                    ]
                }
            )

            return products[0] if products else None
        except Exception as e:
            logger.error("Failed to fetch product details: %s", e)
            return None

    @classmethod
    def search_products(cls, search_term: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Search for products in Odoo.

        Args:
            search_term: Search term for product name or reference
            limit: Maximum number of results to return

        Returns:
            List of product dictionaries
        """
        try:
            products = cls._execute_kw(
                'product.product',
                'search_read',
                [[
                    '|',
                    ('name', 'ilike', search_term),
                    ('default_code', 'ilike', search_term),
                    ('company_id', 'in', [cls.COMPANY_ID, False]),
                ]],
                {
                    'fields': ['id', 'name', 'default_code', 'list_price'],
                    'limit': limit
                },
                context=cls._company_context(),
            )

            # Clean up product names
            for product in products:
                if 'name' in product:
                    # Remove ID prefix if present
                    name = product['name']
                    if isinstance(name, str) and ' ' in name:
                        parts = name.split(' ', 1)
                        if parts[0].isdigit():
                            product['name'] = parts[1]

            return products
        except Exception as e:
            logger.error("Failed to search products: %s", e)
            return []

    @classmethod
    def test_connection(cls) -> Dict[str, Any]:
        """
        Test Odoo connection and return connection details.

        Returns:
            Dictionary with connection status and details
        """
        try:
            cls._initialize_connection()
            local = cls._local

            # Get server version
            version = local.common.version()

            return {
                'status': 'connected',
                'url': cls.URL,
                'database': cls.DB,
                'user_id': local.uid,
                'server_version': version.get('server_version', 'unknown'),
                'protocol_version': version.get('protocol_version', 'unknown')
            }
        except Exception as e:
            return {
                'status': 'failed',
                'error': str(e)
            }

    @classmethod
    def get_pickings_by_source_doc(cls, source_doc: str) -> List[Dict[str, Any]]:
        """
        Fetch all stock.pickings matching a source document.

        Matches by picking name (WH/OUT/XXXXX, WH/RO/XXXXX, ...) or by
        origin (e.g. SO number) — a single origin can map to multiple pickings.
        """
        pickings = cls._execute_kw(
            'stock.picking',
            'search_read',
            [[
                '|',
                ('name', '=', source_doc),
                ('origin', '=', source_doc),
                cls._company_domain(),
            ]],
            {'fields': ['id', 'name', 'origin', 'partner_id', 'state']},
            context=cls._company_context(),
        )

        results: List[Dict[str, Any]] = []
        for p in pickings:
            partner_name = None
            partner_field = p.get('partner_id')
            if partner_field and isinstance(partner_field, list) and len(partner_field) >= 2:
                partner_name = partner_field[1]

            results.append({
                'picking_id': p['id'],
                'picking_name': p['name'],
                'origin': p.get('origin') or '',
                'partner_name': partner_name,
                'state': p.get('state', ''),
            })

        return results

    @classmethod
    def get_packages_for_picking(cls, picking_id: int) -> List[Dict[str, Any]]:
        """
        Fetch packages for a picking via x_site_grn → x_studio_grn_line_86347.

        Path: stock.picking (id) → x_site_grn (x_studio_delivery_order)
              → x_site_grn_line_* (x_site_grn_id) → x_studio_package (stock.quant.package)
        """
        packages: List[Dict[str, Any]] = []
        seen_ids: set = set()

        try:
            # Step 1: find x_site_grn records linked to this picking
            grn_records = cls._execute_kw(
                'x_site_grn',
                'search_read',
                [[('x_studio_delivery_order', '=', picking_id)]],
                {'fields': ['id']}
            )

            grn_ids = [r['id'] for r in grn_records]
            if grn_ids:
                line_model = 'x_site_grn_line_86347'
                try:
                    grn_fields = cls._execute_kw(
                        'x_site_grn',
                        'fields_get',
                        [],
                        {'attributes': ['type', 'relation']}
                    )
                    for field_meta in grn_fields.values():
                        if (
                            field_meta.get('type') == 'one2many'
                            and field_meta.get('relation', '').startswith('x_site_grn_line')
                        ):
                            line_model = field_meta['relation']
                            break
                except Exception as e:
                    logger.warning("Could not discover x_site_grn line model; using %s: %s", line_model, e)

                # Step 2: fetch GRN lines, each carrying an x_studio_package M2o.
                lines = cls._execute_kw(
                    line_model,
                    'search_read',
                    [[('x_site_grn_id', 'in', grn_ids)]],
                    {'fields': ['id', 'x_studio_package', 'x_studio_barcode']}
                )

                for line in lines:
                    pkg = line.get('x_studio_package')
                    if pkg and isinstance(pkg, list) and len(pkg) >= 2 and pkg[0] not in seen_ids:
                        seen_ids.add(pkg[0])
                        barcode = line.get('x_studio_barcode') or None
                        packages.append({
                            'odoo_package_id': pkg[0],
                            'package_name': pkg[1],
                            'odoo_line_id': line['id'],
                            'barcode': barcode,
                        })

        except Exception as e:
            logger.warning("x_site_grn package fetch failed for picking %s: %s", picking_id, e)

        return packages

    @classmethod
    def post_grn_result_to_odoo(cls, picking_id: int, missing_packages: List[str]) -> None:
        """Post GRN submission result as a chatter note on the stock.picking record."""
        if missing_packages:
            body = (
                "<b>GRN submitted with missing packages:</b><br/>"
                + "<br/>".join(f"• {p}" for p in missing_packages)
            )
        else:
            body = "<b>GRN submitted — all packages received.</b>"

        cls._execute_kw(
            'stock.picking',
            'message_post',
            [[picking_id]],
            {'body': body, 'message_type': 'comment', 'subtype_xmlid': 'mail.mt_note'}
        )

    @classmethod
    def update_x_site_grn_status(cls, picking_id: int, has_missing: bool, submitted_at: Any = None) -> None:
        """Write GRN submission status back to x_site_grn linked to the picking."""
        grn_records = cls._execute_kw(
            'x_site_grn',
            'search_read',
            [[('x_studio_delivery_order', '=', picking_id)]],
            {'fields': ['id']}
        )
        grn_ids = [r['id'] for r in grn_records]
        if grn_ids:
            vals: Dict[str, Any] = {
                'x_studio_status': 'Partially complete' if has_missing else 'Done'
            }
            if submitted_at and hasattr(submitted_at, 'strftime'):
                vals['x_studio_received_date'] = submitted_at.strftime('%Y-%m-%d %H:%M:%S')
            cls._execute_kw('x_site_grn', 'write', [grn_ids, vals])

    @classmethod
    def probe_grn_line_fields(cls, field_names: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Introspect x_site_grn_line_86347 field metadata.
        Returns type, string (label), required, readonly for each requested field.
        If field_names is None, returns all fields on the model.
        """
        TARGET_FIELDS = field_names or [
            'x_studio_barcode',
            'x_studio_scan_barcode',
            'x_studio_status',
            'x_studio_scan_time',
        ]

        # Discover actual line model name first (same logic as get_packages_for_picking)
        line_model = 'x_site_grn_line_86347'
        try:
            grn_fields = cls._execute_kw('x_site_grn', 'fields_get', [],
                                         {'attributes': ['type', 'relation']})
            for meta in grn_fields.values():
                if (meta.get('type') == 'one2many'
                        and meta.get('relation', '').startswith('x_site_grn_line')):
                    line_model = meta['relation']
                    break
        except Exception as e:
            logger.warning("Could not discover grn line model: %s", e)

        raw = cls._execute_kw(
            line_model, 'fields_get', [],
            {'attributes': ['type', 'string', 'required', 'readonly', 'selection', 'store']}
        )

        result: Dict[str, Any] = {'model': line_model, 'fields': {}}
        for fname in TARGET_FIELDS:
            if fname in raw:
                result['fields'][fname] = raw[fname]
            else:
                result['fields'][fname] = None  # field not present on model

        return result

    @classmethod
    def writeback_grn_lines(
        cls,
        line_updates: List[Dict[str, Any]],
    ) -> None:
        """
        Write scan results back to x_site_grn_line records.

        Each entry in line_updates must have:
            line_id (int), is_received (bool), scan_barcode (str|None), scan_time (datetime|None)
        """
        line_model = 'x_site_grn_line_86347'
        try:
            grn_fields = cls._execute_kw('x_site_grn', 'fields_get', [],
                                         {'attributes': ['type', 'relation']})
            for meta in grn_fields.values():
                if (meta.get('type') == 'one2many'
                        and meta.get('relation', '').startswith('x_site_grn_line')):
                    line_model = meta['relation']
                    break
        except Exception as e:
            logger.warning("Could not discover grn line model for writeback: %s", e)

        failures = []
        for update in line_updates:
            line_id = update.get('line_id')
            if not line_id:
                continue
            status_val = 'Received' if update.get('is_received') else 'Pending'
            vals: Dict[str, Any] = {'x_studio_status': status_val}

            scan_barcode = update.get('scan_barcode')
            if scan_barcode:
                vals['x_studio_scan_barcode'] = scan_barcode

            scan_time = update.get('scan_time')
            if scan_time:
                # Odoo expects UTC datetime as string: "YYYY-MM-DD HH:MM:SS"
                if hasattr(scan_time, 'strftime'):
                    vals['x_studio_scan_time'] = scan_time.strftime('%Y-%m-%d %H:%M:%S')
                else:
                    vals['x_studio_scan_time'] = str(scan_time)

            try:
                cls._execute_kw(line_model, 'write', [[line_id], vals])
                logger.debug("GRN line %s writeback OK: %s", line_id, vals)
            except Exception as e:
                logger.warning("Failed to write back GRN line %s: %s", line_id, e)
                failures.append(f"line {line_id}: {e}")
        if failures:
            raise RuntimeError("; ".join(failures))
