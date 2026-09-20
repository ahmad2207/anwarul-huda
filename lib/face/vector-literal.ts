// pgvector's own text input format for a vector literal: "[n1,n2,...]",
// cast to ::vector in the SQL that uses it. Shared between enrolment's
// insert (app/account/face/actions.ts) and check-in's match query
// (lib/face/match-face.ts) so the format has exactly one definition.
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
