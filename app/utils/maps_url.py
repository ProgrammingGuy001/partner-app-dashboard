"""Pull a map pin out of whatever Google Maps URL a supervisor pastes.

Supervisors share a site from the Maps app, which produces a short link
(https://maps.app.goo.gl/...). Following that needs the Location header, which CORS
hides from the browser, so resolution happens here and the dashboard does no parsing
of its own.
"""

import re
from urllib.parse import parse_qs, unquote, urlparse

import requests

# Hosts we are willing to fetch server-side. The URL comes from a user, so anything
# not on this list is never requested — this is the SSRF guard, and it applies to
# every redirect hop, not just the first.
ALLOWED_HOSTS = frozenset(
    {
        "maps.app.goo.gl",
        "goo.gl",
        "g.co",
        "google.com",
        "www.google.com",
        "maps.google.com",
        "google.co.in",
        "www.google.co.in",
        "maps.google.co.in",
    }
)

MAX_REDIRECTS = 5
TIMEOUT_S = 5
# Do NOT pretend to be a browser. Google serves browser UAs an app-deeplink
# interstitial (200, no Location header, no coordinates in the body); a plain client
# gets the 302 to the full maps URL with the pin in it.
_USER_AGENT = "partner-app-dashboard/1.0 (+map-link-resolver)"
# The HTML fallback only needs the head of the document — the coordinates appear in
# the first meta tags. Cap the read so a hostile response can't be a memory sink.
_MAX_BODY_BYTES = 64 * 1024

_NUM = r"(-?\d{1,3}(?:\.\d+)?)"
# The place's own pin, buried in the data= blob. More precise than the viewport.
_DATA_PIN = re.compile(rf"!3d{_NUM}!4d{_NUM}")
# The viewport centre. Only roughly where the user was looking, so it is tried last.
_AT_PIN = re.compile(rf"/@{_NUM},{_NUM}")
_PAIR = re.compile(rf"^{_NUM},\s*{_NUM}$")
# Maps URL API parameters, in the order Google documents them.
_QUERY_KEYS = ("q", "query", "ll", "center", "destination", "daddr", "viewpoint")


def _valid(lat: float, lon: float) -> tuple[float, float] | None:
    if -90 <= lat <= 90 and -180 <= lon <= 180:
        return lat, lon
    return None


def _pair_from_value(value: str) -> tuple[float, float] | None:
    # "loc:19.07,72.87" is what the directions UI emits.
    match = _PAIR.match(value.strip().removeprefix("loc:").strip())
    if not match:
        return None
    return _valid(float(match.group(1)), float(match.group(2)))


def _query_values(parsed) -> dict[str, list[str]]:
    return parse_qs(parsed.query, keep_blank_values=False)


def extract_coords(url: str) -> tuple[float, float] | None:
    """(lat, lng) from a Maps URL, or None if it carries no usable pin."""
    parsed = urlparse(url)
    params = _query_values(parsed)

    # An explicit query parameter is the point the user asked for; prefer it.
    for key in _QUERY_KEYS:
        for value in params.get(key, []):
            coords = _pair_from_value(unquote(value))
            if coords:
                return coords

    # The path holds both the place pin and the viewport; the place pin wins.
    for pattern in (_DATA_PIN, _AT_PIN):
        match = pattern.search(unquote(url))
        if match:
            coords = _valid(float(match.group(1)), float(match.group(2)))
            if coords:
                return coords

    return None


def place_name(url: str) -> str | None:
    """The human name in a /maps/place/<name>/ URL, for the search-box fallback."""
    parsed = urlparse(url)

    segments = [segment for segment in parsed.path.split("/") if segment]
    if "place" in segments:
        index = segments.index("place")
        if index + 1 < len(segments):
            name = unquote(segments[index + 1]).replace("+", " ").strip()
            # /maps/place/@19.0,72.8,17z has no name, just the viewport.
            if name and not name.startswith("@"):
                return name

    for key in ("q", "query"):
        for value in _query_values(parsed).get(key, []):
            name = unquote(value).replace("+", " ").strip()
            if name and not _pair_from_value(name):
                return name

    return None


def _host_allowed(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    return (parsed.hostname or "").lower() in ALLOWED_HOSTS


def _coords_in_body(response) -> tuple[float, float] | None:
    """Scan the head of an HTML response — some links land on a coordinate-free URL."""
    body = b""
    for chunk in response.iter_content(8192):
        body += chunk
        if len(body) >= _MAX_BODY_BYTES:
            break
    text = unquote(body.decode("utf-8", errors="ignore"))
    for pattern in (_DATA_PIN, _AT_PIN):
        match = pattern.search(text)
        if match:
            coords = _valid(float(match.group(1)), float(match.group(2)))
            if coords:
                return coords
    return None


def resolve(url: str) -> dict:
    """Resolve any Google Maps URL to {latitude, longitude, place_name}.

    Raises ValueError for a URL we refuse to touch, and requests.RequestException if
    the redirect chain fails. Coordinates may still come back None — a place-name-only
    link is a normal outcome, not an error.
    """
    url = url.strip()
    if not _host_allowed(url):
        raise ValueError("Only Google Maps links are accepted")

    # Full google.com/maps links carry their coordinates; those never leave the server.
    coords = extract_coords(url)
    name = place_name(url)
    if coords:
        return {"latitude": coords[0], "longitude": coords[1], "place_name": name}

    session = requests.Session()
    headers = {"User-Agent": _USER_AGENT, "Accept-Language": "en"}
    current = url
    try:
        for _ in range(MAX_REDIRECTS):
            response = session.get(
                current,
                headers=headers,
                allow_redirects=False,
                timeout=TIMEOUT_S,
                stream=True,
            )
            location = response.headers.get("Location")
            if response.is_redirect and location:
                nxt = requests.compat.urljoin(current, location)
                # A hop off the allowlist is where we stop, not where we fail: the
                # caller still gets the place name and the manual pin.
                if not _host_allowed(nxt):
                    break
                response.close()
                current = nxt
                coords = extract_coords(current)
                name = name or place_name(current)
                if coords:
                    break
                continue

            if response.ok:
                coords = _coords_in_body(response)
            response.close()
            break
    finally:
        session.close()

    return {
        "latitude": coords[0] if coords else None,
        "longitude": coords[1] if coords else None,
        "place_name": name,
    }
