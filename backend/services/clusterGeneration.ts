import ClusterGenerationControl from "../models/ClusterGenerationControl";

export function activeClusterFilter(activeGenerationId: string | null | undefined) {
  // Before the first lifecycle activation, preserve legacy behavior while
  // deliberately excluding any staged generation documents.
  return activeGenerationId
    ? { generationId: activeGenerationId }
    : { generationId: { $in: [null] } };
}

export async function currentClusterFilter() {
  const control: any = await ClusterGenerationControl.findById("cluster-lifecycle").lean();
  return activeClusterFilter(control?.activeGenerationId);
}

export async function readClusterGenerationControl() {
  return ClusterGenerationControl.findById("cluster-lifecycle").lean();
}
