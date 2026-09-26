import { prisma } from "@/lib/prisma";
import { classifySample, evaluateThresholds, judgeSampleSize, reportThresholds } from "@/lib/face/calibration";
import type { FaceThresholds } from "@/lib/face/threshold-settings";

// Everything the calibration screen reports (B3 #1 and #3), in one read.

/** How many gatherings the per-gathering breakdown covers, most recent first. */
const GATHERING_LIMIT = 20;

export async function getCalibrationReport(thresholds: Pick<FaceThresholds, "matchThreshold" | "minMargin">) {
  const samples = await prisma.faceCalibrationSample.findMany({
    select: {
      memberId: true,
      gatheringId: true,
      genuineSimilarity: true,
      bestImpostorSimilarity: true,
      secondImpostorSimilarity: true,
    },
  });

  const verdict = judgeSampleSize(samples);
  const rows = evaluateThresholds(samples, reportThresholds(thresholds.matchThreshold), thresholds.minMargin);

  return { verdict, rows, byGathering: await getGatheringBreakdown(samples, thresholds) };
}

interface SampleScores {
  gatheringId: string;
  genuineSimilarity: number | null;
  bestImpostorSimilarity: number | null;
  secondImpostorSimilarity: number | null;
}

/**
 * Accuracy by gathering (B3 #3), so one room or one lighting condition
 * doing badly is visible. Two kinds of evidence side by side: calibration
 * samples taken there, which have a known right answer, and what live
 * check-in actually did there, which does not, but shows the pattern: how
 * many were checked in by face against by name, how often a close call
 * was refused, and how many face matches only just cleared the margin.
 */
async function getGatheringBreakdown(
  samples: SampleScores[],
  thresholds: Pick<FaceThresholds, "matchThreshold" | "minMargin">,
) {
  const [faceByGathering, manualByGathering, refusalsByGathering] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["gatheringId"],
      where: { method: "FACE" },
      _count: { _all: true },
      _avg: { matchScore: true },
    }),
    prisma.attendanceRecord.groupBy({ by: ["gatheringId"], where: { method: "MANUAL" }, _count: { _all: true } }),
    prisma.faceCheckInRefusal.groupBy({ by: ["gatheringId"], _count: { _all: true } }),
  ]);
  // A margin under twice the minimum is a match that only just cleared it.
  const narrowByGathering = await prisma.attendanceRecord.groupBy({
    by: ["gatheringId"],
    where: { method: "FACE", matchMargin: { lt: thresholds.minMargin * 2 } },
    _count: { _all: true },
  });

  const gatheringIds = new Set<string>([
    ...samples.map((sample) => sample.gatheringId),
    ...faceByGathering.map((row) => row.gatheringId),
    ...refusalsByGathering.map((row) => row.gatheringId),
  ]);
  if (gatheringIds.size === 0) return [];

  const gatherings = await prisma.gathering.findMany({
    where: { id: { in: [...gatheringIds] } },
    select: { id: true, title: true, startsAt: true, branch: { select: { name: true } } },
    orderBy: { startsAt: "desc" },
    take: GATHERING_LIMIT,
  });

  const count = (rows: Array<{ gatheringId: string; _count: { _all: number } }>, id: string) =>
    rows.find((row) => row.gatheringId === id)?._count._all ?? 0;

  return gatherings.map((gathering) => {
    const here = samples.filter((sample) => sample.gatheringId === gathering.id);
    const genuineHere = here.filter((sample) => sample.genuineSimilarity !== null);
    const outcomes = genuineHere.map((sample) => classifySample(sample, thresholds.matchThreshold, thresholds.minMargin));
    const face = faceByGathering.find((row) => row.gatheringId === gathering.id);

    return {
      gatheringId: gathering.id,
      title: gathering.title,
      startsAt: gathering.startsAt,
      branchName: gathering.branch?.name ?? null,
      samples: here.length,
      genuineSamples: genuineHere.length,
      recognised: outcomes.filter((outcome) => outcome === "correct").length,
      falseRejects: outcomes.filter((outcome) => outcome === "false_reject").length,
      wrongPerson: outcomes.filter((outcome) => outcome === "wrong_person").length,
      faceCheckIns: face?._count._all ?? 0,
      averageMatchScore: face?._avg.matchScore ?? null,
      byNameCheckIns: count(manualByGathering, gathering.id),
      refusedAsTooClose: count(refusalsByGathering, gathering.id),
      narrowMatches: count(narrowByGathering, gathering.id),
    };
  });
}
