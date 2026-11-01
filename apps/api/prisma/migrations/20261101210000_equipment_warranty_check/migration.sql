-- The warranty cannot end before the purchase date. The update use case checks it against the
-- record it read, but two concurrent PATCHes (one moving the purchase date, one the warranty)
-- could each pass that check and together store an inconsistent pair; this constraint closes
-- the race. `PrismaEquipmentRepository` maps its violation (by name) to a 400 at `warrantyUntil`.
-- Prisma cannot model CHECK constraints; see the note in `schema.prisma`.
ALTER TABLE "equipment"
  ADD CONSTRAINT "equipment_warranty_after_purchase_check"
  CHECK ("warranty_until" IS NULL OR "warranty_until" >= "purchase_date");
