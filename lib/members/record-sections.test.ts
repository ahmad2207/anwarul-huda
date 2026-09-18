import { describe, expect, it } from "vitest";
import { RECORD_SECTIONS, findRecordSection, recordProgress } from "./record-sections";

describe("record-sections", () => {
  it("lists all nine sections in order", () => {
    expect(RECORD_SECTIONS).toHaveLength(9);
    expect(RECORD_SECTIONS.map((section) => section.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("finds a section by its url key", () => {
    expect(findRecordSection("name")?.section).toBe("NAME");
    expect(findRecordSection("face")?.section).toBe("FACE");
    expect(findRecordSection("not-a-section")).toBeUndefined();
  });

  it("reports zero of nine for a record nothing has been saved on", () => {
    const progress = recordProgress([]);
    expect(progress.completedCount).toBe(0);
    expect(progress.total).toBe(9);
    expect(progress.nextSection?.key).toBe("name");
    expect(progress.isComplete).toBe(false);
  });

  it("counts only the sections actually completed", () => {
    const progress = recordProgress(["NAME", "ABOUT"]);
    expect(progress.completedCount).toBe(2);
    expect(progress.nextSection?.key).toBe("contact");
  });

  it("is complete only once every section, including a deferred face section, is present", () => {
    const allButFace: Array<(typeof RECORD_SECTIONS)[number]["section"]> = [
      "NAME",
      "ABOUT",
      "CONTACT",
      "HOUSEHOLD",
      "MEMBERSHIP",
      "SERVICE",
      "NEXT_OF_KIN",
      "CONSENT",
    ];
    expect(recordProgress(allButFace).isComplete).toBe(false);
    expect(recordProgress([...allButFace, "FACE"]).isComplete).toBe(true);
  });
});
