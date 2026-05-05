import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getInspection } from '@/lib/data';
import EmailForm from './form';

export const dynamic = 'force-dynamic';

export default async function EmailInspectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const owned = await getInspection(id);
  if (!owned) notFound();
  const { inspection: insp } = owned;

  return (
    <div>
      <div className="mb-4 text-sm text-slate-500">
        <Link href={`/inspections/${id}`} className="hover:text-slate-700">
          ← Back to inspection
        </Link>
      </div>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Email report</h1>
        <p className="mt-1 text-sm text-slate-500">
          The latest PDF will be generated and attached.
        </p>
        <EmailForm inspectionId={id} customerName={insp.customerName} address={insp.address} />
      </div>
    </div>
  );
}
