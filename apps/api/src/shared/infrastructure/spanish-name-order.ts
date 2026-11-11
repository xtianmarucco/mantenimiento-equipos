/**
 * ICU Spanish at its default (tertiary) strength, as the `es_natural` column collation. Two ICU
 * builds are coupled here: this uses Node's bundled ICU (78.3 on Node 26), the database uses the
 * postgres image's icu-libs (78.1 in `postgres:18.6-alpine3.24`). Unit tests only check Node
 * against itself; the integration contract suites are what catch a disagreement, so rerun them when
 * either Node or the image changes (README "Collation version").
 */
const spanish = new Intl.Collator('es', { usage: 'sort', sensitivity: 'variant' });

/**
 * UTF-8 byte order, which is code point order: PostgreSQL's tie-break for names a deterministic
 * collation considers equal, and the order of lowercase UUID strings. Plain `<` compares UTF-16
 * code units, which misplaces characters outside the Basic Multilingual Plane.
 */
function byUtf8Bytes(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * The order PostgreSQL gives `ORDER BY name, id` on an `es_natural` name column: Spanish
 * alphabetical order, then UTF-8 bytes for names the collation considers equal, then id. In-memory
 * adapters sort with it so they match their Prisma counterparts.
 */
export function bySpanishNameThenId(
  a: { readonly name: string; readonly id: string },
  b: { readonly name: string; readonly id: string },
): number {
  return spanish.compare(a.name, b.name) || byUtf8Bytes(a.name, b.name) || byUtf8Bytes(a.id, b.id);
}
