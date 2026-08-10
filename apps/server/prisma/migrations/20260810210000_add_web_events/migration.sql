-- Lưu lượng web, đo bằng bảng của chính hệ thống.
--
-- Chỉ thêm, không sửa và không xoá thứ gì đang có: một enum mới, một bảng mới,
-- bốn chỉ mục. Chạy trên database đang phục vụ người dùng thật thì đây là loại
-- thay đổi an toàn nhất — không khoá bảng nào sẵn có, không đụng tới dữ liệu cũ.
--
-- Không lưu IP, không lưu user-agent thô, không đặt cookie. Lý do đầy đủ nằm ở
-- chú thích của model `WebEvent` trong schema.prisma.

-- CreateEnum
CREATE TYPE "WebEventKind" AS ENUM ('VIEW', 'CLICK', 'LEAVE');

-- CreateTable
CREATE TABLE "WebEvent" (
    "id" TEXT NOT NULL,
    "kind" "WebEventKind" NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT,
    "dwellMs" INTEGER,
    "referrer" TEXT,
    "device" TEXT,
    "visitorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebEvent_createdAt_idx" ON "WebEvent"("createdAt");

-- CreateIndex
CREATE INDEX "WebEvent_path_createdAt_idx" ON "WebEvent"("path", "createdAt");

-- CreateIndex
CREATE INDEX "WebEvent_visitorId_createdAt_idx" ON "WebEvent"("visitorId", "createdAt");

-- CreateIndex
CREATE INDEX "WebEvent_kind_createdAt_idx" ON "WebEvent"("kind", "createdAt");
