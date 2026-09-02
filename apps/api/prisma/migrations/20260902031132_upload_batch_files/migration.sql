-- CreateEnum
CREATE TYPE "UploadFileStatus" AS ENUM ('queued', 'uploading', 'processing', 'ready', 'failed');

-- AlterTable
ALTER TABLE "upload_batches" ADD COLUMN     "folder_id" TEXT;

-- CreateTable
CREATE TABLE "upload_batch_files" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "relative_path" TEXT NOT NULL,
    "status" "UploadFileStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "byte_size" BIGINT,
    "document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_batch_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "upload_batch_files_batch_id_idx" ON "upload_batch_files"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "upload_batch_files_batch_id_relative_path_key" ON "upload_batch_files"("batch_id", "relative_path");

-- AddForeignKey
ALTER TABLE "upload_batch_files" ADD CONSTRAINT "upload_batch_files_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "upload_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

