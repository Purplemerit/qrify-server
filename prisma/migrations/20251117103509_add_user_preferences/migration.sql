-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dateFormat" TEXT NOT NULL DEFAULT 'dd/mm/yyyy',
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "timeFormat" TEXT NOT NULL DEFAULT '24';
