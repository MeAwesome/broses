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
    "stillAvailable" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("authorId", "channelId", "content", "createdTimestamp", "guildId", "id", "pinned", "tts") SELECT "authorId", "channelId", "content", "createdTimestamp", "guildId", "id", "pinned", "tts" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
