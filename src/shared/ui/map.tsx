// UI Kit (M4) – bản đồ nền OpenStreetMap (Actor S2) qua Leaflet. Dùng lại ở S02 (vị trí sự cố), S04 (theo dõi), đăng ký/hồ sơ công ty, Admin.
//   <LocationPicker value={pos} onChange={setPos} error={...} />   – chọn 1 tọa độ
//   <MarkersMap markers={[{ id, lat, lng, label, tone }]} />        – hiển thị nhiều điểm
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Alert } from './feedback.tsx';
import { Button } from './form.tsx';

export type LatLng = { lat: number; lng: number };
export const DEFAULT_CENTER: LatLng = { lat: 21.0285, lng: 105.8542 }; // Hồ Hoàn Kiếm, Hà Nội

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

type PinTone = 'danger' | 'primary' | 'success';
const pins = new Map<PinTone, L.DivIcon>();
/** Ghim tròn vẽ bằng CSS theo token màu (không cần file ảnh marker của Leaflet). */
function pin(tone: PinTone) {
  if (!pins.has(tone)) {
    pins.set(tone, L.divIcon({
      className: '',
      html: `<span style="display:block;width:22px;height:22px;border-radius:50%;background:var(--color-${tone});border:3px solid var(--color-surface);box-shadow:0 1px 4px rgb(0 0 0 / .4)"></span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -12],
    }));
  }
  return pins.get(tone)!;
}

function ClickToPick({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: round6(e.latlng.lat), lng: round6(e.latlng.lng) }) });
  return null;
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 16));
  }, [target, map]);
  return null;
}

type PickerProps = {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  /** Tự lấy GPS khi mở nếu chưa có vị trí (S02). */
  autoLocate?: boolean;
  height?: number;
};

/**
 * Chọn tọa độ: chạm vào bản đồ hoặc kéo ghim; nút "Dùng vị trí hiện tại" lấy GPS (tối đa 5 giây).
 * GPS bị từ chối / quá 5 giây → banner vàng, người dùng chọn trên bản đồ (UI Guidelines 3.2.1-c, UC03-2.1).
 */
export function LocationPicker({ value, onChange, label = 'Vị trí', error, disabled, autoLocate, height = 280 }: PickerProps) {
  const [gps, setGps] = useState<'idle' | 'locating' | 'failed'>('idle');
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);

  function locate() {
    if (!navigator.geolocation) return setGps('failed');
    setGps('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: round6(p.coords.latitude), lng: round6(p.coords.longitude) };
        setGps('idle');
        setFlyTarget(here);
        onChange(here);
      },
      () => setGps('failed'),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
    );
  }
  useEffect(() => {
    if (autoLocate && !value && !disabled) locate();
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-label">{label}</span>
        {!disabled && (
          <Button type="button" variant="secondary" size="sm" loading={gps === 'locating'} loadingText="Đang xác định vị trí hiện tại..." onClick={locate}>
            Dùng vị trí hiện tại
          </Button>
        )}
      </div>
      {gps === 'failed' && (
        <Alert tone="warning">Không lấy được vị trí (GPS bị từ chối hoặc tín hiệu yếu). Hãy chạm vào bản đồ để chọn vị trí.</Alert>
      )}
      <div data-invalid={!!error} className="overflow-hidden rounded-control border border-border data-[invalid=true]:border-danger" style={{ height }}>
        <MapContainer center={value ?? DEFAULT_CENTER} zoom={value ? 15 : 13} className="h-full w-full">
          <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
          {!disabled && <ClickToPick onPick={(p) => { setGps('idle'); onChange(p); }} />}
          <FlyTo target={flyTarget} />
          {value && (
            <Marker position={value} icon={pin('danger')} draggable={!disabled} eventHandlers={{
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                onChange({ lat: round6(p.lat), lng: round6(p.lng) });
              },
            }} />
          )}
        </MapContainer>
      </div>
      <p className={`text-body-sm ${error ? 'text-danger' : 'text-text-sub'}`} aria-live="polite">
        {error ?? (value ? `Vĩ độ ${value.lat}, kinh độ ${value.lng}` : disabled ? 'Chưa có vị trí' : 'Chạm vào bản đồ để đặt ghim, kéo ghim để chỉnh.')}
      </p>
    </div>
  );
}

export type MapMarker = LatLng & { id: string | number; label: string; tone?: PinTone };

function FitMarkers({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const key = markers.map((m) => `${m.lat},${m.lng}`).join('|');
  useEffect(() => {
    if (markers.length === 1) map.setView(markers[0], 15);
    else if (markers.length > 1) map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng])), { padding: [32, 32] });
  }, [key, map]);
  return null;
}

/** Hiển thị điểm (sự cố = danger, công ty = primary…), tự căn khung cho vừa mọi điểm; chạm ghim để xem nhãn. */
export function MarkersMap({ markers, height = 280 }: { markers: MapMarker[]; height?: number }) {
  return (
    <div className="overflow-hidden rounded-control border border-border" style={{ height }}>
      <MapContainer center={markers[0] ?? DEFAULT_CENTER} zoom={13} className="h-full w-full">
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <FitMarkers markers={markers} />
        {markers.map((m) => (
          <Marker key={m.id} position={m} icon={pin(m.tone ?? 'primary')} title={m.label}>
            <Popup>{m.label}</Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
