import { describe, expect, it } from "vitest";
import { buildLoginSlipsHtml } from "./login-slip";
import type { LoginSlipData } from "./login-slip";

const SLIP: LoginSlipData = {
  memberName: "Testperson Alpha",
  memberNumber: "AHL/M/2026/0002",
  temporaryPassword: "aB3cD4eF5g",
};

// Transcribed independently from DESIGN.md's own description of the
// logo ("The Arabic reads رابطة أنوار الهدى نيجيريا"), as an explicit
// code point array rather than trusting a second copy of the string
// literal to be correct on its own: a plain string-equality check only
// proves this test file's copy matches login-slip.ts's copy, which
// would happily pass even if both were reversed the same way. This is
// exactly the failure that already happened once: a source string in
// correct logical order was still emitted reversed further down the
// pipeline, so the guard has to compare against a value transcribed
// separately, not against itself.
const EXPECTED_ARABIC_LINE = "رابطة أنوار الهدى نيجيريا";
const EXPECTED_ARABIC_CODE_POINTS = [
  0x0631, 0x0627, 0x0628, 0x0637, 0x0629, // رابطة (Rabita, "League")
  0x0020,
  0x0623, 0x0646, 0x0648, 0x0627, 0x0631, // أنوار (Anwar)
  0x0020,
  0x0627, 0x0644, 0x0647, 0x062f, 0x0649, // الهدى (al-Huda)
  0x0020,
  0x0646, 0x064a, 0x062c, 0x064a, 0x0631, 0x064a, 0x0627, // نيجيريا (Nigeria)
];

function codePointsOf(value: string): number[] {
  return Array.from(value).map((ch) => ch.codePointAt(0)!);
}

describe("buildLoginSlipsHtml", () => {
  it("embeds the member name, member number, password and a sign-in line for a single slip", () => {
    const html = buildLoginSlipsHtml([SLIP], "https://example.test/logo.png");
    expect(html).toContain("aB3cD4eF5g");
    expect(html).toContain("AHL/M/2026/0002");
    expect(html).toContain("Testperson Alpha");
    expect(html).toContain("https://example.test/logo.png");
    expect(html).toMatch(/sign in.*member number and password/i);
  });

  it("carries the logo, the organisation name and the Arabic line in every slip's header", () => {
    const html = buildLoginSlipsHtml([SLIP], "logo.png");
    expect(html).toContain("Anwaru-l-Huda League of Nigeria");
    expect(html).toContain(EXPECTED_ARABIC_LINE);
    expect((html.match(/class="header"/g) ?? []).length).toBe(1);
  });

  // The regression this session's own mistake calls for: this is not a
  // rendering test (Chromium's PDF text layer reversing correctly
  // ordered text is a browser limitation, not something a unit test can
  // exercise), it is a guard on the one thing a source-level test can
  // actually prove, that the string this file emits is stored and
  // handed onward in the correct logical order, code point by code
  // point, never reversed.
  it("stores the Arabic line as the correct, independently verified code point sequence", () => {
    expect(codePointsOf(EXPECTED_ARABIC_LINE)).toEqual(EXPECTED_ARABIC_CODE_POINTS);
  });

  it("emits the Arabic line in that same logical order, never reversed", () => {
    const html = buildLoginSlipsHtml([SLIP], "logo.png");
    const match = html.match(/class="org-arabic"[^>]*>([^<]+)</);
    expect(match).not.toBeNull();
    expect(codePointsOf(match![1])).toEqual(EXPECTED_ARABIC_CODE_POINTS);
  });

  it("marks the Arabic line dir=\"rtl\" and lang=\"ar\" explicitly, rather than relying on implicit direction detection", () => {
    const html = buildLoginSlipsHtml([SLIP], "logo.png");
    expect(html).toMatch(/class="org-arabic"[^>]*dir="rtl"/);
    expect(html).toMatch(/class="org-arabic"[^>]*lang="ar"/);
  });

  it("loads IBM Plex Sans Arabic (DESIGN.md section 7) rather than only listing a fallback", () => {
    const html = buildLoginSlipsHtml([SLIP], "logo.png");
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain("IBM+Plex+Sans+Arabic");
    expect(html).toContain('"IBM Plex Sans Arabic"');
  });

  it("never mentions a phone number or a WhatsApp message", () => {
    const html = buildLoginSlipsHtml([SLIP], "logo.png");
    expect(html.toLowerCase()).not.toContain("phone");
    expect(html.toLowerCase()).not.toContain("whatsapp");
  });

  it("renders one slip per member", () => {
    const slips: LoginSlipData[] = [
      SLIP,
      { ...SLIP, memberName: "Testperson Beta", temporaryPassword: "zZ9yY8xX7w" },
      { ...SLIP, memberName: "Testperson Gamma", temporaryPassword: "mM6nN5oO4p" },
    ];
    const html = buildLoginSlipsHtml(slips, "logo.png");
    expect((html.match(/class="slip"/g) ?? []).length).toBe(3);
    expect(html).toContain("zZ9yY8xX7w");
    expect(html).toContain("mM6nN5oO4p");
  });

  it("fits exactly eight slips on one page, with no page break within it", () => {
    const eightSlips = Array.from({ length: 8 }, (_, i) => ({ ...SLIP, memberName: `Member ${i}` }));
    const html = buildLoginSlipsHtml(eightSlips, "logo.png");
    expect((html.match(/class="sheet"/g) ?? []).length).toBe(1);
    expect(html).not.toContain("page-break-after");
  });

  it("starts a new page after every eighth slip, breaking between pages but never within a slip", () => {
    const nineSlips = Array.from({ length: 9 }, (_, i) => ({ ...SLIP, memberName: `Member ${i}` }));
    const html = buildLoginSlipsHtml(nineSlips, "logo.png");
    expect((html.match(/class="sheet"/g) ?? []).length).toBe(2);
    expect((html.match(/page-break-after: always/g) ?? []).length).toBe(1);
    // Every individual slip is still marked not to split, on every page.
    expect((html.match(/page-break-inside: avoid/g) ?? []).length).toBeGreaterThan(0);
  });

  it("escapes a name that contains HTML-significant characters", () => {
    const html = buildLoginSlipsHtml([{ ...SLIP, memberName: `<b>O'Brien & "Sons"</b>` }], "logo.png");
    expect(html).not.toContain("<b>O'Brien");
    expect(html).toContain("&lt;b&gt;O&#39;Brien &amp; &quot;Sons&quot;&lt;/b&gt;");
  });

  it("shows a fallback for a member with no number issued yet", () => {
    const html = buildLoginSlipsHtml([{ ...SLIP, memberNumber: null }], "logo.png");
    expect(html).toContain("Not yet issued");
  });
});
