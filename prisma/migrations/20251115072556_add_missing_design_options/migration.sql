-- AlterTable
ALTER TABLE "QrCode" ADD COLUMN     "designBgColor" TEXT DEFAULT '#ffffff',
ADD COLUMN     "designDotStyle" INTEGER DEFAULT 1,
ADD COLUMN     "designOuterBorder" INTEGER DEFAULT 1;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "designBgColor" TEXT DEFAULT '#ffffff',
ADD COLUMN     "designDotStyle" INTEGER DEFAULT 1,
ADD COLUMN     "designOuterBorder" INTEGER DEFAULT 1;
