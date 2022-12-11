/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Role` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `MessageMentions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `MessageMentions` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `MessageReactions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `MessageReactions` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - You are about to alter the column `A` on the `_mentionedUsers` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.
  - The primary key for the `Message` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `MessageAttachments` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `A` on the `_MessageMentionsToRole` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Int`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayname" TEXT NOT NULL,
    "discriminator" INTEGER NOT NULL,
    "avatar" TEXT NOT NULL
);
INSERT INTO "new_User" ("avatar", "discriminator", "displayname", "id", "username") SELECT "avatar", "discriminator", "displayname", "id", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE TABLE "new_Role" (
    "id" TEXT NOT NULL PRIMARY KEY
);
INSERT INTO "new_Role" ("id") SELECT "id" FROM "Role";
DROP TABLE "Role";
ALTER TABLE "new_Role" RENAME TO "Role";
CREATE TABLE "new_MessageMentions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" TEXT NOT NULL,
    "everyone" BOOLEAN NOT NULL,
    "repliedUserId" TEXT NOT NULL,
    CONSTRAINT "MessageMentions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MessageMentions_repliedUserId_fkey" FOREIGN KEY ("repliedUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MessageMentions" ("everyone", "id", "messageId", "repliedUserId") SELECT "everyone", "id", "messageId", "repliedUserId" FROM "MessageMentions";
DROP TABLE "MessageMentions";
ALTER TABLE "new_MessageMentions" RENAME TO "MessageMentions";
CREATE UNIQUE INDEX "MessageMentions_messageId_key" ON "MessageMentions"("messageId");
CREATE TABLE "new_MessageReactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" TEXT NOT NULL,
    CONSTRAINT "MessageReactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MessageReactions" ("id", "messageId") SELECT "id", "messageId" FROM "MessageReactions";
DROP TABLE "MessageReactions";
ALTER TABLE "new_MessageReactions" RENAME TO "MessageReactions";
CREATE UNIQUE INDEX "MessageReactions_messageId_key" ON "MessageReactions"("messageId");
CREATE TABLE "new__mentionedUsers" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_mentionedUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "MessageMentions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_mentionedUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new__mentionedUsers" ("A", "B") SELECT "A", "B" FROM "_mentionedUsers";
DROP TABLE "_mentionedUsers";
ALTER TABLE "new__mentionedUsers" RENAME TO "_mentionedUsers";
CREATE UNIQUE INDEX "_mentionedUsers_AB_unique" ON "_mentionedUsers"("A", "B");
CREATE INDEX "_mentionedUsers_B_index" ON "_mentionedUsers"("B");
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "createdTimestamp" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT,
    "pinned" BOOLEAN NOT NULL,
    "tts" BOOLEAN NOT NULL,
    CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("authorId", "channelId", "content", "createdTimestamp", "guildId", "id", "pinned", "tts") SELECT "authorId", "channelId", "content", "createdTimestamp", "guildId", "id", "pinned", "tts" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE TABLE "new_MessageAttachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "attachment" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    CONSTRAINT "MessageAttachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MessageAttachments" ("attachment", "contentType", "description", "id", "messageId", "name") SELECT "attachment", "contentType", "description", "id", "messageId", "name" FROM "MessageAttachments";
DROP TABLE "MessageAttachments";
ALTER TABLE "new_MessageAttachments" RENAME TO "MessageAttachments";
CREATE UNIQUE INDEX "MessageAttachments_messageId_key" ON "MessageAttachments"("messageId");
CREATE TABLE "new__MessageMentionsToRole" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MessageMentionsToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "MessageMentions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MessageMentionsToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new__MessageMentionsToRole" ("A", "B") SELECT "A", "B" FROM "_MessageMentionsToRole";
DROP TABLE "_MessageMentionsToRole";
ALTER TABLE "new__MessageMentionsToRole" RENAME TO "_MessageMentionsToRole";
CREATE UNIQUE INDEX "_MessageMentionsToRole_AB_unique" ON "_MessageMentionsToRole"("A", "B");
CREATE INDEX "_MessageMentionsToRole_B_index" ON "_MessageMentionsToRole"("B");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
