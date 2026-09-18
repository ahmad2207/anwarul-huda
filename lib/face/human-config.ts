import type { Config } from "@vladmandic/human";

// Only what enrolment (and later, check-in) actually needs: face
// detection, the embedding model, and the two anti-spoofing signals
// (SPEC-ADDENDUM-ACCOUNTS-AND-FACE.md 3.3, "never load it on any route
// other than enrolment and check-in"). Body, hand, object, gesture and
// segmentation are disabled outright rather than merely unused, so
// their models are never fetched at all: mesh, iris, emotion, attention
// and gear are disabled the same way, since none of them serve
// embedding, liveness or anti-spoofing either, and every one of them is
// megabytes this route has no reason to ask a member's data plan for.
//
// detector.return stays false, its default: a detected face never
// carries a cropped tensor of itself in the result object at all with
// this off, which is the strongest version of "no image data leaves
// this frame's processing" available, stronger than producing one and
// disposing it afterwards. deallocate: true means a discarded frame's
// tensors are garbage collected immediately rather than cached for
// reuse, for the same reason.
export const HUMAN_CONFIG: Partial<Config> = {
  backend: "webgl",
  // Self hosted from public/models (only the four files this route
  // needs, copied out of the package's much larger full model set)
  // rather than a third party CDN: this is biometric capture, not a
  // demo, so it should not depend on jsDelivr's availability or add a
  // host this app's own CSP has to trust for a route this sensitive.
  modelBasePath: "/models/",
  cacheModels: true,
  deallocate: true,
  debug: false,
  face: {
    enabled: true,
    detector: { enabled: true, rotation: true, maxDetected: 1, return: false },
    description: { enabled: true },
    liveness: { enabled: true },
    antispoof: { enabled: true },
    mesh: { enabled: false },
    attention: { enabled: false },
    iris: { enabled: false },
    emotion: { enabled: false },
    gear: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: false },
  segmentation: { enabled: false },
  filter: { enabled: false },
};
