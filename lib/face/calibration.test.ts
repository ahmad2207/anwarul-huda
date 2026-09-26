import { describe, expect, it } from "vitest";
import { classifySample, evaluateThresholds, judgeSampleSize, reportThresholds, wilsonInterval } from "./calibration";

function sample(genuine: number | null, best: number | null = null, second: number | null = null) {
  return { genuineSimilarity: genuine, bestImpostorSimilarity: best, secondImpostorSimilarity: second };
}

describe("classifySample", () => {
  it("is correct when the member's own face is best, above threshold and clear of the runner-up", () => {
    expect(classifySample(sample(0.8, 0.3), 0.5, 0.05)).toBe("correct");
  });

  it("is a false reject below threshold, or when refused as too close to call", () => {
    expect(classifySample(sample(0.45, 0.2), 0.5, 0.05)).toBe("false_reject");
    expect(classifySample(sample(0.7, 0.68), 0.5, 0.05)).toBe("false_reject");
  });

  it("is the wrong person when someone else's face wins clearly", () => {
    expect(classifySample(sample(0.4, 0.8), 0.5, 0.05)).toBe("wrong_person");
  });

  it("judges a member with no enrolment as a stranger", () => {
    expect(classifySample(sample(null, 0.3), 0.5, 0.05)).toBe("stranger_rejected");
    expect(classifySample(sample(null, 0.7, 0.2), 0.5, 0.05)).toBe("stranger_accepted");
    expect(classifySample(sample(null, 0.7, 0.68), 0.5, 0.05)).toBe("stranger_rejected");
  });
});

describe("wilsonInterval", () => {
  it("gives no rate with nothing measured", () => {
    expect(wilsonInterval(0, 0)).toMatchObject({ rate: null, low: null, high: null });
  });

  it("keeps a real upper bound at zero errors, wider for a small sample", () => {
    const small = wilsonInterval(0, 10);
    const large = wilsonInterval(0, 200);
    expect(small.rate).toBe(0);
    expect(small.low).toBe(0);
    expect(small.high!).toBeGreaterThan(0.2);
    expect(large.high!).toBeLessThan(0.03);
  });
});

describe("evaluateThresholds", () => {
  it("trades false rejects against wrong matches as the threshold moves", () => {
    const samples = [sample(0.9, 0.3), sample(0.6, 0.35), sample(0.55, 0.62), sample(null, 0.58)];
    const [low, high] = evaluateThresholds(samples, [0.5, 0.7], 0.05);

    expect(low.falseReject.count).toBe(0);
    expect(low.wrongPerson.count).toBe(1); // 0.62 beats the member's own 0.55
    expect(low.strangerAccepted.count).toBe(1);

    expect(high.falseReject.count).toBe(2);
    expect(high.wrongPerson.count).toBe(0);
    expect(high.strangerAccepted.count).toBe(0);
    expect(high.falseReject.total).toBe(3);
  });
});

describe("reportThresholds", () => {
  it("covers 0.30 to 0.80 and always includes the threshold in force", () => {
    const thresholds = reportThresholds(0.47);
    expect(thresholds[0]).toBe(0.3);
    expect(thresholds.at(-1)).toBe(0.8);
    expect(thresholds).toContain(0.47);
  });
});

describe("judgeSampleSize", () => {
  it("says plainly when there are too few samples, and when there are no strangers", () => {
    const verdict = judgeSampleSize([{ ...sample(0.8, 0.2), memberId: "a" }]);
    expect(verdict.enough).toBe(false);
    expect(verdict.messages[0]).toMatch(/^Too few samples to draw a conclusion/);
    expect(verdict.messages.some((message) => message.includes("without a face enrolment"))).toBe(true);
  });

  it("accepts enough captures of enough different members", () => {
    const samples = Array.from({ length: 30 }, (_, index) => ({ ...sample(0.8, 0.2), memberId: `m${index % 10}` }));
    expect(judgeSampleSize(samples).enough).toBe(true);
  });
});
