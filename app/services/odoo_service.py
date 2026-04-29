import logging
import ssl
import xmlrpc.client  # nosec B411  — monkey-patched below via defusedxml
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

    # Initialize connections
    _common = None
    _uid = None
    _models = None

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
            if cls.URL in invalid_values: missing.append("ODOO_URL")
            if cls.DB in invalid_values: missing.append("ODOO_DB")
            if cls.USERNAME in invalid_values: missing.append("ODOO_USERNAME")
            if cls.PASSWORD in invalid_values: missing.append("ODOO_PASSWORD")
            logger.error("Odoo configuration incomplete. Missing: %s", ", ".join(missing))
            raise HTTPException(
                status_code=503,
                detail=f"Odoo service not configured. Missing: {', '.join(missing)}"
            )

        if force or cls._uid is None:
            try:
                logger.info("Connecting to Odoo: %s (db=%s, user=%s)", cls.URL, cls.DB, cls.USERNAME)
                cls._common = xmlrpc.client.ServerProxy(
                    f'{cls.URL}/xmlrpc/2/common',
                    transport=_build_odoo_transport(cls.URL, cls._ssl_context),
                    allow_none=True,
                )
                cls._uid = cls._common.authenticate(cls.DB, cls.USERNAME, cls.PASSWORD, {})
                cls._models = xmlrpc.client.ServerProxy(
                    f'{cls.URL}/xmlrpc/2/object',
                    transport=_build_odoo_transport(cls.URL, cls._ssl_context),
                    allow_none=True,
                )

                if not cls._uid:
                    logger.error("Odoo authentication failed - invalid credentials")
                    raise HTTPException(
                        status_code=401,
                        detail="Failed to authenticate with Odoo - check credentials"
                    )
                logger.info("Odoo connection successful (uid=%s)", cls._uid)
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
                    detail=f"Failed to connect to Odoo service: {str(e)}",
                ) from e

    @classmethod
    def _execute_kw(cls, model: str, method: str, args: List, kwargs: Dict = None) -> Any:
        """Execute Odoo XML-RPC method with error handling and retry mechanism"""
        cls._initialize_connection()
        if kwargs is None:
            kwargs = {}

        try:
            return cls._models.execute_kw(
                cls.DB, cls._uid, cls.PASSWORD,
                model, method, args, kwargs
            )
        except (xmlrpc.client.ProtocolError, OSError, ConnectionError) as net_err:
            # Network or protocol failures (e.g., dropped connection, session timeout)
            logger.warning("Odoo connection dropped, attempting reconnect... Error: %s", net_err)
            try:
                cls._initialize_connection(force=True)
                return cls._models.execute_kw(
                    cls.DB, cls._uid, cls.PASSWORD,
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

    @classmethod
    def fetch_full_bom_data(cls, sales_order: str, cabinet_position: str) -> List[Dict[str, Any]]:
        """
        Fetch complete BOM hierarchy from Odoo for a given sales order and cabinet position.

        Args:
            sales_order: Sales order number
            cabinet_position: Cabinet position identifier

        Returns:
            List of BOM items with nested children hierarchy

        Raises:
            HTTPException: If no BOM items found or Odoo error occurs
        """
        # Fetch sale.order.line items
        sale_lines = cls._execute_kw(
            'sale.order.line',
            'search_read',
            [[
                ('order_id.name', '=', sales_order),
                ('x_studio_cabinet_position', '=', cabinet_position),
                ('company_id', '=', 1),
            ]],
            {
                'fields': [
                    'id', 'name', 'product_id', 'x_studio_cabinet_position',
                    'product_uom_qty', 'product_uom'
                ]
            }
        )

        if not sale_lines:
            raise HTTPException(
                status_code=404,
                detail=f"No BOM items found for sales order '{sales_order}' and cabinet position '{cabinet_position}'"
            )

        def explode_bom(
            product_id: int,
            product_tmpl_id: int,
            quantity: float = 1.0,
            depth: int = 0,
            max_depth: int = 10,
            visited_boms: Optional[Set[int]] = None
        ) -> List[Dict[str, Any]]:
            """
            Recursively explode BOM to get all components.

            Args:
                product_id: Product variant ID
                product_tmpl_id: Product template ID
                quantity: Quantity multiplier for nested items
                depth: Current recursion depth
                max_depth: Maximum recursion depth to prevent infinite loops
                visited_boms: Set of already visited BOM IDs to detect cycles

            Returns:
                List of component dictionaries with nested children
            """
            if visited_boms is None:
                visited_boms = set()

            # Prevent infinite recursion
            if depth > max_depth:
                logger.warning("Max recursion depth %d reached at depth %d", max_depth, depth)
                return []

            # Find applicable BOM for this product
            domain = [
                ('product_tmpl_id', '=', product_tmpl_id),
                ('company_id', '=', 1),
            ]
            if product_id:
                domain = ['|', ('product_id', '=', product_id)] + domain

            boms = cls._execute_kw(
                'mrp.bom',
                'search_read',
                [domain],
                {
                    'fields': ['id', 'product_id', 'product_tmpl_id', 'product_qty', 'product_uom_id'],
                    'limit': 1
                }
            )

            if not boms:
                # No BOM found - this is a leaf component (raw material)
                return []

            bom = boms[0]
            bom_id = bom['id']

            # Check for cycles to prevent infinite loops
            if bom_id in visited_boms:
                logger.warning("Cycle detected: BOM %s already visited in this path", bom_id)
                return []

            # Mark this BOM as visited in current path
            visited_boms.add(bom_id)
            logger.debug("Depth %d: Processing BOM ID %s for product_tmpl_id %s", depth, bom_id, product_tmpl_id)

            # Fetch BOM lines (the actual components in this BOM)
            bom_lines = cls._execute_kw(
                'mrp.bom.line',
                'search_read',
                [[('bom_id', '=', bom_id), ('company_id', '=', 1)]],
                {
                    'fields': ['id', 'product_id', 'product_qty', 'product_uom_id', 'bom_id']
                }
            )

            result = []
            for line in bom_lines:
                line_product_id = cls.safe_extract_id(line.get('product_id'))
                line_qty = line.get('product_qty', 0)

                # Extract clean product name
                product_name = cls.extract_product_name(line.get('product_id'))

                if line_product_id:
                    # Get product template for this component
                    product = cls._execute_kw(
                        'product.product',
                        'read',
                        [[line_product_id]],
                        {'fields': ['product_tmpl_id']}
                    )

                    if product:
                        line_product_tmpl_id = cls.safe_extract_id(
                            product[0].get('product_tmpl_id')
                        )

                        component = {
                            'product_name': product_name,
                            'depth': depth,
                            'children': []
                        }

                        # Recursively explode if this component has its own BOM
                        # Pass a copy of visited_boms to allow same BOM in different branches
                        child_components = explode_bom(
                            line_product_id,
                            line_product_tmpl_id,
                            line_qty * quantity,
                            depth + 1,
                            max_depth,
                            visited_boms.copy()  # Copy to allow reuse in sibling branches
                        )

                        if child_components:
                            component['children'] = child_components

                        result.append(component)

            return result

        # Process each sale order line
        processed_items = []
        for line in sale_lines:
            product_id = cls.safe_extract_id(line.get('product_id'))
            quantity = line.get('product_uom_qty', 1.0)

            # Extract clean product name
            product_name = cls.extract_product_name(line.get('product_id'))

            if product_id:
                # Get product template
                product = cls._execute_kw(
                    'product.product',
                    'read',
                    [[product_id]],
                    {'fields': ['product_tmpl_id']}
                )

                if product:
                    product_tmpl_id = cls.safe_extract_id(
                        product[0].get('product_tmpl_id')
                    )

                    item = {
                        'product_name': product_name,
                        'cabinet_position': line.get('x_studio_cabinet_position'),
                        'depth': 0,
                        'children': explode_bom(product_id, product_tmpl_id, quantity)
                    }

                    processed_items.append(item)

        return processed_items

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
            [[('name', '=', sales_order), ('company_id', '=', 1)]],
            {
                'fields': [
                    'name', 'partner_id', 'partner_shipping_id',
                    'client_order_ref', 'x_studio_project_name',
                    'amount_total', 'state',
                ],
                'limit': 1,
            }
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
        partner_id = shipping_partner_id or billing_partner_id

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

        # Fetch partner (customer) details
        if partner_id:
            partners = cls._execute_kw(
                'res.partner',
                'read',
                [[partner_id]],
                {
                    'fields': [
                        'name', 'phone', 'mobile', 'email',
                        'street', 'street2', 'city', 'zip',
                        'state_id', 'country_id',
                    ]
                }
            )

            if partners:
                partner = partners[0]
                result['customer_name'] = partner.get('name') or ''
                result['phone'] = partner.get('phone') or partner.get('mobile') or ''
                result['email'] = partner.get('email') or ''

                # Store street and street2 as separate address lines
                result['address_line_1'] = partner.get('street') or ''
                result['address_line_2'] = partner.get('street2') or ''

                result['city'] = partner.get('city') or ''
                result['pincode'] = partner.get('zip') or ''

                # Extract state name
                state_field = partner.get('state_id')
                if state_field and isinstance(state_field, list) and len(state_field) >= 2:
                    # Remove country suffix like " (IN)"
                    state_name = state_field[1]
                    if ' (' in state_name:
                        state_name = state_name.split(' (')[0]
                    result['state'] = state_name

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
                [[('name', '=', sales_order), ('company_id', '=', 1)]],
                {'limit': 1}
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
                [[('order_id.name', '=', sales_order), ('company_id', '=', 1)]],
                {'fields': ['x_studio_cabinet_position']}
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
                    ('company_id', 'in', [1, False]),
                ]],
                {
                    'fields': ['id', 'name', 'default_code', 'list_price'],
                    'limit': limit
                }
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

            # Get server version
            version = cls._common.version()

            return {
                'status': 'connected',
                'url': cls.URL,
                'database': cls.DB,
                'user_id': cls._uid,
                'server_version': version.get('server_version', 'unknown'),
                'protocol_version': version.get('protocol_version', 'unknown')
            }
        except Exception as e:
            return {
                'status': 'failed',
                'error': str(e)
            }
