-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('RUNNING', 'FINISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "status" "BattleStatus" NOT NULL DEFAULT 'RUNNING',
    "configSnapshot" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "winnerTeamKey" TEXT,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleScore" (
    "battleId" TEXT NOT NULL,
    "teamKey" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "castleHp" INTEGER NOT NULL DEFAULT 1000,
    "soldierCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BattleScore_pkey" PRIMARY KEY ("battleId","teamKey")
);

-- CreateTable
CREATE TABLE "BattleDonor" (
    "battleId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "teamKey" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BattleDonor_pkey" PRIMARY KEY ("battleId","username")
);

-- CreateIndex
CREATE INDEX "Battle_userId_status_idx" ON "Battle"("userId", "status");

-- CreateIndex
CREATE INDEX "BattleDonor_battleId_totalScore_idx" ON "BattleDonor"("battleId", "totalScore");

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleScore" ADD CONSTRAINT "BattleScore_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleDonor" ADD CONSTRAINT "BattleDonor_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

