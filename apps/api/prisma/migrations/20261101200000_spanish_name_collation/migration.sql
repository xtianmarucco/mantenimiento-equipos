-- Spanish alphabetical order for names, independent of the server's libc (musl on
-- postgres:18-alpine sorts by code point). ICU locale `es` at its default (tertiary) strength:
-- letters decide first, so accents and case do not push a name to the end ("Álamo" sits with
-- "Alameda", "ñ" follows "n"); accents and case only break ties (lowercase first).
-- Deterministic (the default): strings that differ in any byte stay unequal, so equality,
-- B-tree indexes, LIKE and any future unique constraint behave as before.
-- Prisma cannot model column collations; see the note in `schema.prisma`.
CREATE COLLATION IF NOT EXISTS "es_natural" (provider = icu, locale = 'es');

-- AlterTable
ALTER TABLE "locations" ALTER COLUMN "name" SET DATA TYPE VARCHAR(120) COLLATE "es_natural";

-- AlterTable
ALTER TABLE "equipment" ALTER COLUMN "name" SET DATA TYPE VARCHAR(120) COLLATE "es_natural";
