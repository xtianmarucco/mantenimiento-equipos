-- CreateEnum
CREATE TYPE "location_kind" AS ENUM ('OWN_STORE', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "equipment_type" AS ENUM ('FREEZER', 'REFRIGERATOR', 'DISPLAY_CASE', 'ICE_CREAM_MACHINE', 'OTHER');

-- CreateEnum
CREATE TYPE "equipment_status" AS ENUM ('OPERATIONAL', 'IN_REPAIR', 'OUT_OF_SERVICE', 'RETIRED');

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" "location_kind" NOT NULL,
    "address" VARCHAR(200),
    "contact_name" VARCHAR(120),
    "phone" VARCHAR(20),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "equipment_type" NOT NULL,
    "brand" VARCHAR(80) NOT NULL,
    "model" VARCHAR(80) NOT NULL,
    "serial_number" VARCHAR(80),
    "purchase_date" DATE NOT NULL,
    "warranty_until" DATE,
    "status" "equipment_status" NOT NULL DEFAULT 'OPERATIONAL',
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "location_id" UUID NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_code_key" ON "equipment"("code");

-- CreateIndex
CREATE INDEX "equipment_location_id_idx" ON "equipment"("location_id");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
