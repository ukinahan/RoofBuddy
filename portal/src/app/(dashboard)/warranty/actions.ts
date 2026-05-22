'use server';
import { dismissWarrantyReminder } from '@/lib/features';

export async function dismiss(id: number) {
  return dismissWarrantyReminder(id);
}
