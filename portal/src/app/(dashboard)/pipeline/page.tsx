import { listInspectionSummaries } from '@/lib/features';
import PipelineBoard from './board';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  const items = await listInspectionSummaries();
  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Pipeline</h1>
        <span className="text-sm text-slate-500">{items.length} active</span>
      </div>
      <PipelineBoard items={items} />
    </div>
  );
}
