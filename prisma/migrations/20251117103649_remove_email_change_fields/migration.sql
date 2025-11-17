/*
  Warnings:

  - You are about to drop the column `newEmail` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `newEmailToken` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `newEmailTokenExpires` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_newEmailToken_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "newEmail",
DROP COLUMN "newEmailToken",
DROP COLUMN "newEmailTokenExpires";
