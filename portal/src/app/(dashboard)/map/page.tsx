import { listInspectionSummaries } from '@/lib/features';
import MapView from './map';

export const dynamic = 'force-dynamic';

export default async function MapPage() {
  const items = await listInspectionSummaries();
  const pinned = items.filter((i) => i.latitude != null && i.longitude != null);
  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Map</h1>
        <span className="text-sm text-slate-500">
          {pinned.length} of {items.length} have coordinates
        </span>
      </div>
      <MapView items={pinned} />
      {pinned.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">
          No inspections have GPS coordinates yet. The mobile app captures coordinates
          automatically when location permission is granted.
        </p>
      )}
    </div>
  );
}
