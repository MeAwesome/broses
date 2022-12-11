/*
  Warnings:

  - Added the required column `displayname` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "displayname" TEXT NOT NULL,
    "discriminator" INTEGER NOT NULL,
    "avatar" TEXT NOT NULL
);
INSERT INTO "new_User" ("avatar", "discriminator", "id", "username") SELECT "avatar", "discriminator", "id", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
