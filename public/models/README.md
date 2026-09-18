# Face recognition models

These four files are committed binaries, not source: the TensorFlow.js
weights [vladmandic/human](https://github.com/vladmandic/human) needs
for face enrolment (`/account/face`), copied out of
`node_modules/@vladmandic/human/models/` rather than the full model set
the package ships:

- `blazeface.bin` / `blazeface.json` — face detection
- `faceres.bin` / `faceres.json` — the face embedding itself
- `liveness.bin` / `liveness.json` — liveness score
- `antispoof.bin` / `antispoof.json` — anti-spoofing score

Total size: ~8.8MB. See `lib/face/human-config.ts` for why they are
self-hosted from here rather than loaded from a third party CDN, and
`app/account/face/face-capture.tsx` for how they are lazy loaded, on
this one route only.

## Why committed to the repository

This was a deliberate decision, not an oversight. The alternative
considered was serving these from Supabase Storage instead. At 8.8MB
total (largest single file 6.8MB), this is nowhere near a real limit
either way: GitHub blocks a single file over 100MB, and Vercel's static
file upload limit is 100MB on Hobby and 1GB on Pro. Moving them to
Storage would also mean a new public bucket (the existing one in
`lib/storage.ts` is deliberately private, for member data, a different
trust level entirely), an upload step, and confirming CORS on a public
bucket a browser can fetch from directly. Committing them is the
simpler choice today, and correct while they stay small and effectively
frozen.

## When to revisit this

These are static binaries that will never change under normal
operation: a model upgrade means replacing all four deliberately, not a
routine edit. That is exactly the situation Git LFS exists for. If
clone weight or repository size ever becomes a real problem, or if
these models start changing more often than "practically never",
**Git LFS is the intended next step**, not Supabase Storage: it solves
"large binary that changes rarely" without needing a public bucket,
CORS, or a runtime dependency on Storage being reachable.

If you are the one making that call later: `git lfs track "public/models/*.bin"`,
commit `.gitattributes`, then migrate the existing blobs with
`git lfs migrate import --include="public/models/*.bin"`.
