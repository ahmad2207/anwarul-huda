import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { toVectorLiteral } from "@/lib/face/vector-literal";

// Face threshold calibration (SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md B3).
//
// A sample is a live capture of a known member, taken at a real gathering
// in its real lighting. It is scored against the enrolled faces the same
// way check-in would score it, and only those scores are stored: the
// capture's embedding is discarded here, after scoring, and never written
// anywhere (see the FaceCalibrationSample model). Error rates at any
// threshold are then worked out from the stored scores by replaying
// check-in's own decision rule.

export class CalibrationError extends Error {}

interface ScoreRow {
  similarity: number;
}

export interface CalibrationScores {
  genuineSimilarity: number | null;
  bestImpostorSimilarity: number | null;
  secondImpostorSimilarity: number | null;
}

/**
 * Scores one capture of a known member: against their own enrolment (the
 * genuine score), and against the two closest other members check-in at
 * this gathering would have compared with (the same wing scope, active
 * and not excluded, exactly as matchFaceForCheckIn filters).
 */
async function scoreCapture(embedding: number[], memberId: string, gatheringWingId: string | null): Promise<CalibrationScores> {
  const vector = toVectorLiteral(embedding);
  const wingFilter = gatheringWingId ? Prisma.sql`AND m.wing_id = ${gatheringWingId}` : Prisma.empty;

  const [genuine, impostors] = await Promise.all([
    prisma.$queryRaw<ScoreRow[]>`
      SELECT 1 - (embedding <=> ${vector}::vector) AS similarity
      FROM face_enrolments
      WHERE member_id = ${memberId} AND is_active = true
      ORDER BY embedding <=> ${vector}::vector ASC
      LIMIT 1
    `,
    prisma.$queryRaw<ScoreRow[]>(Prisma.sql`
      SELECT 1 - (fe.embedding <=> ${vector}::vector) AS similarity
      FROM face_enrolments fe
      JOIN members m ON m.id = fe.member_id
      WHERE fe.is_active = true
        AND fe.member_id <> ${memberId}
        AND m.status = 'ACTIVE'
        AND m.face_check_in_excluded = false
        ${wingFilter}
      ORDER BY fe.embedding <=> ${vector}::vector ASC
      LIMIT 2
    `),
  ]);

  return {
    genuineSimilarity: genuine[0]?.similarity ?? null,
    bestImpostorSimilarity: impostors[0]?.similarity ?? null,
    secondImpostorSimilarity: impostors[1]?.similarity ?? null,
  };
}

export async function recordCalibrationSample(
  actor: { id: string; roles: string[] },
  input: { gatheringId: string; memberId: string; embedding: number[]; livenessScore: number },
): Promise<CalibrationScores> {
  if (!actor.roles.includes("SUPER_ADMIN")) {
    throw new CalibrationError("Only a super administrator can record calibration samples.");
  }

  const [gathering, member] = await Promise.all([
    prisma.gathering.findUnique({ where: { id: input.gatheringId }, select: { id: true, wingId: true } }),
    prisma.member.findUnique({ where: { id: input.memberId }, select: { id: true, consentBiometric: true } }),
  ]);
  if (!gathering) throw new CalibrationError("That gathering could not be found.");
  if (!member) throw new CalibrationError("That member could not be found.");
  // A calibration capture is still a capture of someone's face, even if
  // only scores are kept: never of a member who has not agreed to face
  // check-in.
  if (!member.consentBiometric) {
    throw new CalibrationError("This member has not consented to face check-in, so they cannot be used for calibration.");
  }

  const scores = await scoreCapture(input.embedding, member.id, gathering.wingId);
  // input.embedding is not referenced again: only the scores outlive this call.

  const sample = await prisma.faceCalibrationSample.create({
    data: {
      gatheringId: gathering.id,
      memberId: member.id,
      ...scores,
      livenessScore: input.livenessScore,
      recordedById: actor.id,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "face_calibration.sample_recorded",
    entity: "FaceCalibrationSample",
    entityId: sample.id,
    before: null,
    after: { gatheringId: gathering.id, memberId: member.id, ...scores },
  });

  return scores;
}

// ---------------------------------------------------------------
// Evaluation: pure, so it is tested without a camera or a database
// ---------------------------------------------------------------

export type SampleOutcome = "correct" | "false_reject" | "wrong_person" | "stranger_rejected" | "stranger_accepted";

/**
 * What check-in would have done with this capture at a given threshold
 * and margin, by the same rule as decideFaceMatch: below threshold is no
 * match, a best score too close to the runner-up is refused, otherwise
 * the best is accepted. Then judged against who was really there.
 */
export function classifySample(sample: CalibrationScores, threshold: number, minMargin: number): SampleOutcome {
  const candidates: Array<{ genuine: boolean; similarity: number }> = [];
  if (sample.genuineSimilarity !== null) candidates.push({ genuine: true, similarity: sample.genuineSimilarity });
  if (sample.bestImpostorSimilarity !== null) candidates.push({ genuine: false, similarity: sample.bestImpostorSimilarity });
  if (sample.secondImpostorSimilarity !== null) candidates.push({ genuine: false, similarity: sample.secondImpostorSimilarity });
  candidates.sort((a, b) => b.similarity - a.similarity);

  const [best, runnerUp] = candidates;
  const accepted =
    best !== undefined && best.similarity >= threshold && (runnerUp === undefined || best.similarity - runnerUp.similarity >= minMargin);

  if (sample.genuineSimilarity === null) {
    return accepted ? "stranger_accepted" : "stranger_rejected";
  }
  if (!accepted) return "false_reject";
  return best.genuine ? "correct" : "wrong_person";
}

export interface RateWithInterval {
  count: number;
  total: number;
  /** count / total, or null with nothing to measure. */
  rate: number | null;
  /** 95% Wilson interval: where the true rate plausibly lies, given how few samples there are. */
  low: number | null;
  high: number | null;
}

/** 95% Wilson score interval, which stays sensible at 0 errors and with small samples, unlike a plain percentage. */
export function wilsonInterval(count: number, total: number): RateWithInterval {
  if (total === 0) return { count, total, rate: null, low: null, high: null };
  const z = 1.96;
  const p = count / total;
  const denominator = 1 + (z * z) / total;
  const centre = (p + (z * z) / (2 * total)) / denominator;
  const spread = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominator;
  return { count, total, rate: p, low: Math.max(0, centre - spread), high: Math.min(1, centre + spread) };
}

export interface ThresholdEvaluation {
  threshold: number;
  /** Enrolled member not recognised: refused or below threshold. They are checked in by name instead. */
  falseReject: RateWithInterval;
  /** Enrolled member recognised as somebody else: the worst outcome, attendance credited to the wrong person. */
  wrongPerson: RateWithInterval;
  /** Someone with no enrolment matched to a member. */
  strangerAccepted: RateWithInterval;
}

export function evaluateThresholds(samples: CalibrationScores[], thresholds: number[], minMargin: number): ThresholdEvaluation[] {
  const genuine = samples.filter((sample) => sample.genuineSimilarity !== null);
  const strangers = samples.filter((sample) => sample.genuineSimilarity === null);

  return thresholds.map((threshold) => {
    const genuineOutcomes = genuine.map((sample) => classifySample(sample, threshold, minMargin));
    const strangerOutcomes = strangers.map((sample) => classifySample(sample, threshold, minMargin));
    return {
      threshold,
      falseReject: wilsonInterval(genuineOutcomes.filter((outcome) => outcome === "false_reject").length, genuine.length),
      wrongPerson: wilsonInterval(genuineOutcomes.filter((outcome) => outcome === "wrong_person").length, genuine.length),
      strangerAccepted: wilsonInterval(
        strangerOutcomes.filter((outcome) => outcome === "stranger_accepted").length,
        strangers.length,
      ),
    };
  });
}

/** The thresholds the report compares, from 0.30 to 0.80 in steps of 0.05, plus the one in force. */
export function reportThresholds(current: number): number[] {
  const steps = Array.from({ length: 11 }, (_, index) => Math.round((0.3 + index * 0.05) * 100) / 100);
  return [...new Set([...steps, Math.round(current * 1000) / 1000])].sort((a, b) => a - b);
}

/** Below these, the report says plainly that no conclusion can be drawn (B3). */
export const MIN_GENUINE_SAMPLES = 30;
export const MIN_DISTINCT_MEMBERS = 10;

export interface SampleSizeVerdict {
  enough: boolean;
  genuineSamples: number;
  strangerSamples: number;
  distinctMembers: number;
  /** Plain sentences for the report, most important first. */
  messages: string[];
}

export function judgeSampleSize(samples: Array<CalibrationScores & { memberId: string }>): SampleSizeVerdict {
  const genuine = samples.filter((sample) => sample.genuineSimilarity !== null);
  const strangerSamples = samples.length - genuine.length;
  const distinctMembers = new Set(genuine.map((sample) => sample.memberId)).size;
  const messages: string[] = [];

  if (genuine.length < MIN_GENUINE_SAMPLES || distinctMembers < MIN_DISTINCT_MEMBERS) {
    messages.push(
      `Too few samples to draw a conclusion: ${genuine.length} captures of ${distinctMembers} enrolled ${
        distinctMembers === 1 ? "member" : "members"
      }. Collect at least ${MIN_GENUINE_SAMPLES} captures of at least ${MIN_DISTINCT_MEMBERS} different members, in the lighting check-in really happens in, before changing the threshold.`,
    );
  }
  if (genuine.length > 0) {
    // The rule of three: with no errors seen in n tries, the true rate
    // could still plausibly be as high as about 3 in n.
    messages.push(
      `With ${genuine.length} captures, a rate of zero only shows the true rate is probably below about ${Math.ceil(
        (3 / genuine.length) * 100,
      )}%. Read the ranges, not just the percentages.`,
    );
  }
  if (strangerSamples === 0) {
    messages.push(
      "No captures of members without a face enrolment yet, so there is no measure of how often someone unenrolled is matched to a member.",
    );
  }

  return {
    enough: genuine.length >= MIN_GENUINE_SAMPLES && distinctMembers >= MIN_DISTINCT_MEMBERS,
    genuineSamples: genuine.length,
    strangerSamples,
    distinctMembers,
    messages,
  };
}
