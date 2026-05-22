'use server';

import { setInspectionStage, setInspectionSchedule, createPublicQuoteToken } from '@/lib/features';
import type { PipelineStage } from '@/lib/types';

export async function changeStage(id: string, stage: PipelineStage) {
  return setInspectionStage(id, stage);
}

export async function schedule(id: string, isoOrEmpty: string) {
  return setInspectionSchedule(id, isoOrEmpty || null);
}

export async function makePublicLink(id: string) {
  return createPublicQuoteToken(id);
}
