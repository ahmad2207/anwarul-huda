import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lower cases and hyphenates a plain title", () => {
    expect(slugify("Friday Jumu'ah Reminder")).toBe("friday-jumu-ah-reminder");
  });

  it("collapses runs of punctuation into a single hyphen", () => {
    expect(slugify("Zakat: what it covers -- and what it doesn't")).toBe(
      "zakat-what-it-covers-and-what-it-doesn-t",
    );
  });

  it("trims a leading or trailing hyphen", () => {
    expect(slugify("  -Weekly Book #12-  ")).toBe("weekly-book-12");
  });

  it("falls back to a fixed word when nothing usable remains", () => {
    expect(slugify("!!!")).toBe("item");
  });
});
