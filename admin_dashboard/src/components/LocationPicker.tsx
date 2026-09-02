import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link2, Loader2, Search, X } from 'lucide-react';
import { jobAPI } from '@/api/services';

// react-leaflet ships without bundled marker assets, and mergeOptions is flaky under
// Vite (imported PNGs can resolve to module objects / anchor gets dropped → broken pin).
// Build an explicit icon and hand it to <Marker icon=...> instead.
const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// India bounding box (minLon,minLat,maxLon,maxLat) + centre bias for address search.
const INDIA_BBOX = '68.0,6.5,97.5,37.5';

// Centre of India — used until the admin searches or drops a pin.
const DEFAULT_CENTER: [number, number] = [22.3511, 78.6677];
const DEFAULT_ZOOM = 5;
const PINNED_ZOOM = 16;
const DEFAULT_RADIUS = 100;

export interface LocationValue {
  latitude: number | null;
  longitude: number | null;
  geofenceRadius: number | null;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] }; // [lon, lat]
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

/** Address parts behind a pin. Any field may be missing — Photon fills what it knows. */
export interface ResolvedAddress {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  /** Called with the address behind a pin dropped from a pasted Maps link. */
  onAddress?: (address: ResolvedAddress) => void;
}

function describeFeature(f: PhotonFeature): string {
  const p = f.properties;
  const parts = [
    [p.housenumber, p.street].filter(Boolean).join(' ') || p.name,
    p.city,
    p.state,
    p.postcode,
    p.country,
  ].filter(Boolean);
  return parts.join(', ');
}

function toAddress(f: PhotonFeature): ResolvedAddress {
  const p = f.properties;
  return {
    address_line_1: [p.housenumber, p.street].filter(Boolean).join(' ') || p.name,
    address_line_2: p.district,
    city: p.city || p.county,
    state: p.state,
    // The form wants a 6-digit Indian PIN; anything else is Photon guessing.
    pincode: /^\d{6}$/.test(p.postcode ?? '') ? p.postcode : undefined,
  };
}

/** Photon reverse geocode — same free service as the search box above. */
async function reverseGeocode(lat: number, lng: number): Promise<ResolvedAddress | null> {
  const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en&limit=1`);
  const data = await res.json();
  const feature: PhotonFeature | undefined = data.features?.[0];
  return feature ? toAddress(feature) : null;
}

/** Moves the map when a search result is picked (decoupled from pin drags). */
function FlyTo({ target }: { target: { lat: number; lng: number; key: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), PINNED_ZOOM));
    }
  }, [target, map]);
  return null;
}

/** Forces a size recalc — the picker mounts in a modal that may size after init. */
function MapReady() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

/** Drops/moves the pin on map click. */
function ClickToPlace({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange, onAddress }) => {
  const { latitude, longitude, geofenceRadius } = value;
  const hasPin = latitude != null && longitude != null;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const [mapUrl, setMapUrl] = useState('');
  const [resolving, setResolving] = useState(false);
  const [urlStatus, setUrlStatus] = useState<{ kind: 'ok' | 'info' | 'error'; text: string } | null>(null);
  const markerRef = useRef<L.Marker>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  // The last URL we resolved, so blur-after-Enter doesn't fire a second request.
  const resolvedRef = useRef('');

  const radius = geofenceRadius ?? DEFAULT_RADIUS;

  const clearSearch = () => {
    setQuery('');
    setResults([]);
  };

  // Dismiss the suggestion dropdown on outside click or Escape.
  useEffect(() => {
    if (results.length === 0) return;
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setResults([]);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [results.length]);

  // Debounced Photon search (free, no API key, no caps).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
            `&limit=8&lang=en&lat=22.3511&lon=78.6677&bbox=${INDIA_BBOX}`,
        );
        const data = await res.json();
        // bbox only biases results, so drop anything not in India.
        const features: PhotonFeature[] = (data.features || []).filter(
          (f: PhotonFeature) => f.properties.country === 'India',
        );
        if (!cancelled) setResults(features);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const placePin = (lat: number, lng: number) => {
    onChange({ latitude: lat, longitude: lng, geofenceRadius: radius });
  };

  // Supervisors already have the site open in the Maps app, so the share link is the
  // fastest route to a pin. Short links resolve on the backend — CORS hides the
  // redirect from us — so this is one round trip, not client-side parsing.
  const resolveMapUrl = async (raw: string) => {
    const url = raw.trim();
    if (!url || url === resolvedRef.current) return;
    resolvedRef.current = url;
    setResolving(true);
    setUrlStatus(null);
    try {
      const resolved = await jobAPI.resolveMapUrl(url);
      if (resolved.latitude != null && resolved.longitude != null) {
        placePin(resolved.latitude, resolved.longitude);
        setFlyTarget({ lat: resolved.latitude, lng: resolved.longitude, key: Date.now() });
        setUrlStatus({ kind: 'ok', text: 'Pin dropped from the link — drag it if the site is slightly off.' });
        // Best-effort: the pin is the point of the link, the address is a bonus.
        if (onAddress) {
          reverseGeocode(resolved.latitude, resolved.longitude)
            .then((address) => address && onAddress(address))
            .catch(() => {});
        }
      } else if (resolved.place_name) {
        // The link named a place but carried no pin; hand it to the address search.
        setQuery(resolved.place_name);
        setUrlStatus({
          kind: 'info',
          text: `No coordinates in that link — searching for "${resolved.place_name}". Pick a result or drop the pin.`,
        });
      } else {
        setUrlStatus({ kind: 'error', text: "Couldn't read a location from that link. Drop the pin on the map instead." });
      }
    } catch (err) {
      resolvedRef.current = ''; // let them retry the same URL
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setUrlStatus({
        kind: 'error',
        text: typeof detail === 'string' ? detail : 'Could not open that link. Drop the pin on the map instead.',
      });
    } finally {
      setResolving(false);
    }
  };

  const handleSelectResult = (f: PhotonFeature) => {
    const [lng, lat] = f.geometry.coordinates;
    placePin(lat, lng);
    setFlyTarget({ lat, lng, key: Date.now() });
    setQuery(describeFeature(f));
    setResults([]);
  };

  const markerHandlers = useMemo(
    () => ({
      dragend() {
        const m = markerRef.current;
        if (m) {
          const pos = m.getLatLng();
          placePin(pos.lat, pos.lng);
        }
      },
    }),
    // placePin closes over radius; recreate when radius changes
    [radius],
  );

  return (
    <div className="space-y-2">
      <Label>Job Location (drag the pin to the exact site)</Label>

      {/* Paste a Google Maps share link — the pin comes straight off it */}
      <div className="relative">
        <Link2 className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={mapUrl}
          onChange={(e) => setMapUrl(e.target.value)}
          onPaste={(e) => {
            // Resolve on paste so nobody has to press Enter afterwards.
            const pasted = e.clipboardData.getData('text');
            if (pasted.trim()) {
              setMapUrl(pasted);
              resolveMapUrl(pasted);
            }
          }}
          onBlur={(e) => resolveMapUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              // The picker lives inside a form; Enter here must not submit the job.
              e.preventDefault();
              resolveMapUrl(mapUrl);
            }
          }}
          placeholder="Paste a Google Maps link (maps.app.goo.gl/… or google.com/maps/…)"
          className="pl-8 pr-8"
        />
        {resolving && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {urlStatus && (
        <p
          className={
            urlStatus.kind === 'error'
              ? 'text-xs text-destructive'
              : urlStatus.kind === 'ok'
                ? 'text-xs text-success'
                : 'text-xs text-muted-foreground'
          }
        >
          {urlStatus.text}
        </p>
      )}

      {/* Search box — convenience to jump the map near the address */}
      <div className="relative" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an address in India to jump the map…"
            className="pl-8 pr-8"
          />
          {searching ? (
            <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            (query || results.length > 0) && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>
        {results.length > 0 && (
          <ul className="absolute z-[1000] mt-1 w-full rounded-md border bg-white shadow-md max-h-56 overflow-auto">
            {results.map((f, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleSelectResult(f)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted/90"
                >
                  {describeFeature(f)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map with draggable pin — the primary, always-works method */}
      <div className="h-72 w-full overflow-hidden rounded-md border">
        <MapContainer
          center={hasPin ? [latitude as number, longitude as number] : DEFAULT_CENTER}
          zoom={hasPin ? PINNED_ZOOM : DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapReady />
          <FlyTo target={flyTarget} />
          <ClickToPlace onPlace={placePin} />
          {hasPin && (
            <>
              <Marker
                position={[latitude as number, longitude as number]}
                icon={defaultIcon}
                draggable
                eventHandlers={markerHandlers}
                ref={markerRef}
              />
              <Circle
                center={[latitude as number, longitude as number]}
                radius={radius}
                pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15 }}
              />
            </>
          )}
        </MapContainer>
      </div>

      <div className="flex items-center gap-3">
        <div className="space-y-1">
          <Label htmlFor="geofence_radius" className="text-xs">Geofence radius (m)</Label>
          <Input
            id="geofence_radius"
            type="number"
            min={10}
            max={5000}
            value={radius}
            onChange={(e) =>
              onChange({ latitude, longitude, geofenceRadius: Number(e.target.value) || DEFAULT_RADIUS })
            }
            className="w-32"
          />
        </div>
        <p className="text-xs text-muted-foreground self-end pb-2">
          {hasPin
            ? `Pinned at ${(latitude as number).toFixed(6)}, ${(longitude as number).toFixed(6)}`
            : 'Click the map or search to drop a pin.'}
        </p>
      </div>
    </div>
  );
};

export default LocationPicker;
