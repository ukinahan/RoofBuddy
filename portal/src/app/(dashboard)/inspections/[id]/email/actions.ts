'use server';

import { Resend } from 'resend';
import { getInspection, getCompanyProfile, getCurrentUser } from '@/lib/data';
import { renderInspectionPdf } from '@/lib/pdf';

export async function sendInspectionEmail(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const id = String(formData.get('id') ?? '');
  const to = String(formData.get('to') ?? '').trim();
  const cc = String(formData.get('cc') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!id) return { ok: false, error: 'Inspection id missing.' };
  if (!to) return { ok: false, error: 'Recipient email is required.' };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'noreply@roofinspector.app';
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not configured on the server.' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const owned = await getInspection(id);
  if (!owned) return { ok: false, error: 'Inspection not found.' };
  const { inspection, ownerId } = owned;

  const profile = await getCompanyProfile(ownerId).catch(() => null);

  // Render PDF using the same HTML builder the mobile app uses.
  const pdf = await renderInspectionPdf(inspection, profile, ownerId);
  const filename = `roof-survey-report-${(inspection.customerName || 'report')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()}.pdf`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    cc: cc ? cc.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) : undefined,
    subject: subject || `Roof inspection report — ${inspection.customerName}`,
    text: body || `Please find attached the roof inspection report for ${inspection.address}.`,
    attachments: [
      {
        filename,
        content: Buffer.from(pdf).toString('base64'),
      },
    ],
  });

  if (error) return { ok: false, error: `${error.name ?? 'error'}: ${error.message}` };
  return { ok: true };
}
