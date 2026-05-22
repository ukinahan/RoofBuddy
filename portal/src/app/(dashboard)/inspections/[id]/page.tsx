import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getInspection, signPhotoUrl } from '@/lib/data';
import InspectionEditor from './editor';
import InspectionMeta from './meta';
import ActivityPanel from './activity-panel';
import type { PipelineStage } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owned = await getInspection(id);
  if (!owned) notFound();
  const { inspection: insp, ownerId } = owned;

  // Pre-sign photo URLs server-side so the editor can render thumbnails
  // without exposing storage paths or doing N round-trips from the client.
  // Photos live under the OWNER's user-id folder, not the viewer's — matters
  // when an assistant has been granted shared access.
  const photoUrls: Record<string, string> = {};
  await Promise.all(
    insp.photos.map(async (p) => {
      const url = await signPhotoUrl(ownerId, p.id);
      if (url) photoUrls[p.id] = url;
    }),
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-700">
          ← Back to inspections
        </Link>
      </div>
      <div className="space-y-6">
        <InspectionMeta
          id={insp.id}
          initialStage={(insp.pipelineStage ?? 'inspected') as PipelineStage}
          initialScheduledAt={insp.scheduledAt ?? null}
        />
        <InspectionEditor inspection={insp} photoUrls={photoUrls} />
        <ActivityPanel inspectionId={insp.id} />
      </div>
    </div>
  );
}
