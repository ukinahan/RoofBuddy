'use server';
import { setInspectionStage } from '@/lib/features';
import type { PipelineStage } from '@/lib/types';

export async function moveStage(id: string, stage: PipelineStage) {
  return setInspectionStage(id, stage);
}
