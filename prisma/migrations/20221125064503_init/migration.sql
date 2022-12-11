-- CreateTable
CREATE TABLE "Role" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "discriminator" INTEGER NOT NULL,
    "avatar" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelId" INTEGER NOT NULL,
    "guildId" INTEGER NOT NULL,
    "createdTimestamp" DATETIME NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT,
    "pinned" BOOLEAN NOT NULL,
    "tts" BOOLEAN NOT NULL,
    CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageReactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" INTEGER NOT NULL,
    CONSTRAINT "MessageReactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageMentions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" INTEGER NOT NULL,
    "everyone" BOOLEAN NOT NULL,
    "repliedUserId" INTEGER NOT NULL,
    CONSTRAINT "MessageMentions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MessageMentions_repliedUserId_fkey" FOREIGN KEY ("repliedUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageAttachments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "messageId" INTEGER NOT NULL,
    "attachment" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    CONSTRAINT "MessageAttachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_mentionedUsers" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_mentionedUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "MessageMentions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_mentionedUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_MessageMentionsToRole" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_MessageMentionsToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "MessageMentions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MessageMentionsToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageReactions_messageId_key" ON "MessageReactions"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageMentions_messageId_key" ON "MessageMentions"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageAttachments_messageId_key" ON "MessageAttachments"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "_mentionedUsers_AB_unique" ON "_mentionedUsers"("A", "B");

-- CreateIndex
CREATE INDEX "_mentionedUsers_B_index" ON "_mentionedUsers"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_MessageMentionsToRole_AB_unique" ON "_MessageMentionsToRole"("A", "B");

-- CreateIndex
CREATE INDEX "_MessageMentionsToRole_B_index" ON "_MessageMentionsToRole"("B");
