/*
  Warnings:

  - You are about to alter the column `createdTimestamp` on the `Message` table. The data in that column could be lost. The data in that column will be cast from `String` to `DateTime`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "createdTimestamp" DATETIME NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT,
    "pinned" BOOLEAN NOT NULL,
    "tts" BOOLEAN NOT NULL,
    CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("authorId", "channelId", "content", "createdTimestamp", "guildId", "id", "pinned", "tts") SELECT "authorId", "channelId", "content", "createdTimestamp", "guildId", "id", "pinned", "tts" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
