-- CreateTable
CREATE TABLE "number_sequences" (
    "key" TEXT NOT NULL,
    "last_issued" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("key")
);

