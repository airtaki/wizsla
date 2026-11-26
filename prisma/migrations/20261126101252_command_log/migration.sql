-- CreateTable
CREATE TABLE "CommandLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "apiKeyId" INTEGER,
    "keyName" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "targetId" INTEGER,
    "targetName" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "bulbs" INTEGER NOT NULL,
    "succeeded" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    CONSTRAINT "CommandLog_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CommandLog_createdAt_idx" ON "CommandLog"("createdAt");
