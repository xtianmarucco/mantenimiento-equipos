-- CreateEnum
CREATE TYPE "equipment_event_type" AS ENUM ('MAINTENANCE', 'BREAKDOWN', 'REPAIR', 'TRANSFER', 'REPLACEMENT', 'RETIREMENT');

-- CreateTable
CREATE TABLE "equipment_events" (
    "id" UUID NOT NULL,
    "type" "equipment_event_type" NOT NULL,
    "occurred_on" DATE NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "technician" VARCHAR(120),
    "cost" DECIMAL(10,2),
    "resulting_status" "equipment_status",
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipment_id" UUID NOT NULL,
    "from_location_id" UUID,
    "to_location_id" UUID,
    "replacement_equipment_id" UUID,

    CONSTRAINT "equipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_events_equipment_id_occurred_on_created_at_idx" ON "equipment_events"("equipment_id", "occurred_on" DESC, "created_at" DESC);

-- AddForeignKey
ALTER TABLE "equipment_events" ADD CONSTRAINT "equipment_events_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_events" ADD CONSTRAINT "equipment_events_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_events" ADD CONSTRAINT "equipment_events_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_events" ADD CONSTRAINT "equipment_events_replacement_equipment_id_fkey" FOREIGN KEY ("replacement_equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written (Prisma cannot model CHECK constraints; see the note in `schema.prisma`). The shared
-- schema already rejects a negative cost; this keeps a direct write from storing one.
ALTER TABLE "equipment_events"
  ADD CONSTRAINT "equipment_events_cost_non_negative_check"
  CHECK ("cost" IS NULL OR "cost" >= 0);
