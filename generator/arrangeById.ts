// The render tools' lookup: a piece or a jingle by id, arranged with
// `name=value` overrides over its defaults (a jingle also takes version=tidy|rewrite).
// Node-only.

import { arrange } from "../lib/arrange.ts";
import { type JingleVersion, jingleAsPiece, resolveJingleParams } from "../lib/jingles.ts";
import { resolveParams } from "../lib/params.ts";
import type { Performance } from "../lib/performance.ts";
import { loadJingles } from "./jingles.ts";
import { loadPieces } from "./scores.ts";

export function arrangeById(id: string, overrides: Record<string, string>): Performance {
  const piece = loadPieces().find((p) => p.meta.id === id);
  if (piece) return arrange(piece.meta, piece.score, resolveParams(piece.meta, overrides));
  const jingle = loadJingles().find((j) => j.meta.id === id);
  if (!jingle) throw new Error(`No piece or jingle ${id}`);
  const params = resolveJingleParams(jingle.meta, overrides);
  const asPiece = jingleAsPiece(jingle.meta, params);
  return arrange(asPiece.piece, jingle.scores[params.version as JingleVersion], asPiece.params);
}
