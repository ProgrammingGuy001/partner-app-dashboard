import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, X } from 'lucide-react';

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
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
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

const LocationPicker: React.FC<LocationPickerProps> = ({ value, onChange }) => {
  const { latitude, longitude, geofenceRadius } = value;
  const hasPin = latitude != null && longitude != null;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; key: number } | null>(null);
  const markerRef = useRef<L.Marker>(null);
  const searchRef = useRef<HTMLDivElement>(null);

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
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
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
