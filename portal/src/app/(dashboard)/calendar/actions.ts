'use server';
import { setInspectionSchedule } from '@/lib/features';

export async function setSchedule(id: string, scheduledAt: string | null) {
  return setInspectionSchedule(id, scheduledAt);
}
