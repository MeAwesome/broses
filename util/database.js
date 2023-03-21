//const { prisma } = require('@prisma/client');
const getEmojiUnicode = require('emoji-unicode');
const emojiNameMap = require("emoji-name-map");
//const db = require("./database/prismaHelper.js");
const surreal = require("./database/surreal.js");

let allMessagesTransactions = {};
//let allReactions = {};

async function connect(){
    await surreal.setup("https://surrealdb.meaweso.me/rpc");
    await surreal.rootSignIn("root", "root");
    await surreal.use("broses", "discord");
    //await surreal.importCacheFromFile();

    // let message;

    // await surreal.clearCache();

    //WHERE id = message:1077436746633068564;

    //SELECT * FROM write WHERE in = user:564597179910586369 AND out = message:1077436746633068564;
    //SELECT * from inside ORDER BY time.created DESC LIMIT 10 FETCH in;
    
    // message = (await surreal.query(`
    // SELECT * from message:1077531723266527282
    // `))[0];

    // console.log("before cache:", message);
    
    // message = (await surreal.query(`
    // SELECT * FROM message WHERE id = message:1077436746633068564;
    // `))[0];

    //console.log(surreal.getCache());

    //await surreal.exportCacheToFile();
}

async function fullSync() {
    console.log("\n--STARTING FULLSYNC--\n ! This will take a while ! \n");
    console.time("fullsync");
    await syncMembers();
    // let query = (await db.query("message", "updateMany", {
    //     data: {
    //         stillAvailable: false
    //     }
    // })).query;
    // await db.execute(query);
    // await surreal.query(`
    // UPDATE message MERGE {
    //     stillAvailable = false
    // }
    // `);
    await syncChannels(true);
    console.timeEnd("fullsync");
    console.log("\n--FULLSYNC COMPLETE--\n");
}

async function syncMembers() {
    console.log("\n--STARTING MEMBER SYNC--\n");
    const members = await discord.getMembers();
    for (let member of members) {
        await updateUser(member);
    }
    await surreal.exportCacheToFile();
    console.log("\n--ALL MEMBERS SYNCED--\n");
}

async function syncChannels(force) {
    console.log("\n--STARTING CHANNEL SYNC--\n");
    const channels = await discord.getChannels();
    const promises = [];
    for (let channel of channels) {
        //allMessages[channel.id] = [];
        //allReactions[channel.id] = [];
        //if(channel.name == "bot"){
            await updateChannel(channel);
            promises.push(syncChannel(channel, force));
        //}
    }
    await Promise.all(promises);
    console.log("All channels ready for upgrades");
    for (let channelTransaction of Object.values(allMessagesTransactions)) {
        console.time("transaction");
        await surreal.query(channelTransaction);
        console.timeEnd("transaction");
    }
    // console.log("All reactions ready for upgrades");
    // for (let channelReactions of Object.values(allReactions).filter((reactions) => reactions.length > 0)) {
    //     console.time("reaction transaction");
    //     let transaction = (await db.transaction(channelReactions)).transaction;
    //     await db.execute(transaction);
    //     console.timeEnd("reaction transaction");
    // }
    //allMessages = {};
    //allReactions = {};
    //await surreal.exportCacheToFile();
    console.log("\n--ALL CHANNELS SYNCED--\n ! A FullSync might still be required if messages were edited or deleted while the bot was offline ! \n");
}

async function updateChannel(channel) {
    await surreal.query(`UPDATE channel:${channel.id} MERGE ${updateChannelJSON(channel)}`);
    //console.log(`${channel.name} in sync!`);
}

async function updateUser(member) {
    //let query = (await db.query("user", "upsert", upsertMemberJSON(member))).query;
    //await db.execute(query);
    await surreal.query(`UPDATE user:${member.user.id} MERGE ${updateMemberJSON(member)}`);
    console.log(`${member.user.username} in sync!`);
}

async function syncChannel(channel, force) {
    return new Promise(async (resolve, reject) => {
        let lastMessageIDStored = await getLastMessageIDFromChannel(channel);
        let latestMessageExists = await messageExists(channel.lastMessageId);
        let lastId = null;
        let size = 100;
        let lastMessageReached = false;
        console.log(latestMessageExists);
        if (!latestMessageExists || force) {
            allMessagesTransactions[channel.id] = "BEGIN TRANSACTION;";
            while (size == 100) {
                const messages = await discord.getMessages(channel, {
                    limit: 100,
                    before: lastId
                })
                if (!messages.last()) {
                    break;
                }
                const messageValues = messages.values();
                for (const message of messageValues) {
                    if (message.id == lastMessageIDStored && !force) {
                        lastMessageReached = true;
                        break;
                    }

                    await upsertMessage(message);
                    //let query = (await db.query("message", "upsert", upsertMessageJSON(message))).query;
                    //allMessages[channel.id].push(query);

                    // for (let reaction of message.reactions.cache.values()) {
                    //     reaction = await fixReactionEmojiUsers(reaction);
                    //     //console.log(users);
                    //     query = (await db.query("messageReaction", "upsert", upsertMessageReactionJSON(reaction))).query;
                    //     allReactions[channel.id].push(query);
                    // }
                }
                lastId = messages.last().id;
                size = lastMessageReached ? 0 : messages.size;
            }
            allMessagesTransactions[channel.id] = allMessagesTransactions[channel.id].concat("COMMIT TRANSACTION;");
            //console.log(allMessagesTransactions[channel.id]);
        }
        console.log(`${channel.name} is ready for upgrades`);
        resolve();
    });
}

async function newChannel(channel) {
    await surreal.query(`CREATE channel:${channel.id} CONTENT ${createChannelJSON(channel)}`);
}

async function upsertMessage(message) {
     //SELECT * FROM write WHERE in = user:${message.author.id} AND out = message:${message.id};
    let dbMessage;
    try {
        dbMessage = (await surreal.query(`
        SELECT *, <-write AS write FROM message:${message.id} FETCH write;
        `, true))[0].result[0];
        dbMessage.write = dbMessage.write[0];
    } catch {
        dbMessage = {};
    }
    if (Object.keys(dbMessage).length == 0){
        await newMessage(message, dbMessage);
        // create
    } else {
        await editMessage(message, dbMessage);
    }
    // let test = await surreal.query(`
    // BEGIN TRANSACTION;
    // UPDATE message:${message.id} MERGE ${updateMessageJSON(message)};
    // LET $relation = (SELECT * FROM write WHERE in = user:${message.author.id} AND out = message:${message.id});
    // LET $allrelations = (SELECT * FROM write);
    // IF $allrelations CONTAINSNOT $relation THEN
    //     RELATE user:${message.author.id}->write->message:${message.id} SET time.created = ${message.createdTimestamp}, time.updated = [], previous.content = [];
    //     RELATE message:${message.id}->inside->channel:${message.channelId} SET time.created = ${message.createdTimestamp}, time.updated = [], previous.content = [];
    // ELSE
    //     LET $oldcontent = (SELECT ->message.content AS content FROM write WHERE in = user:${message.author.id} AND out = message:${message.id})
    //     UPDATE (SELECT * FROM write WHERE in = user:${message.author.id} AND out = message:${message.id}) SET time.updated += ${message.editedTimestamp}, previous.content += $oldcontent;
    // END
    // COMMIT TRANSACTION;
    // `);
    // console.log(relation[0].result[0]);
    // console.log(allrelations[0].result);
    // if(message.editedTimestamp == null){

    // }
}

async function messageCreate(message) {
    console.time("new create");
    console.log(message.createdTimestamp);
    surreal.query(`
    BEGIN TRANSACTION;
    CREATE message:${message.id} CONTENT ${createMessageJSON(message)};
    RELATE user:${message.author.id}->write->message:${message.id} SET time.created = ${message.createdTimestamp}, time.updated = [], history.content += ${JSON.stringify(message.content)};
    RELATE message:${message.id}->inside->channel:${message.channelId} SET time.created = ${message.createdTimestamp}, time.updated = [], history.content += ${JSON.stringify(message.content)};
    UPDATE info:message SET newest.created.${message.channelId} = message:${message.id};
    COMMIT TRANSACTION;
    `);
    console.timeEnd("new create");
}

async function newMessage(message, dbMessage) {
    //console.log(message);
    //console.time("new");
    //console.log(message.createdTimestamp);
    // await surreal.query(`
    // BEGIN TRANSACTION;
    // CREATE message:${message.id} CONTENT ${createMessageJSON(message)};
    // RELATE user:${message.author.id}->write->message:${message.id} SET time.created = ${message.createdTimestamp}, time.updated = [], history.content += ${JSON.stringify(message.content)};
    // RELATE message:${message.id}->inside->channel:${message.channelId} SET time.created = ${message.createdTimestamp}, time.updated = [], history.content += ${JSON.stringify(message.content)};
    // LET $newest = (SELECT <-write.time.created AS created FROM (SELECT newest.created.${message.channelId} AS message FROM info:message));
    // UPDATE info:message SET newest.created.${message.channelId} = IF $newest[0][0] >= ${message.createdTimestamp} OR $newest[0] = null THEN message:${message.id} END;
    // COMMIT TRANSACTION;
    // `);
    //console.log("new");
    let transaction = `
    CREATE message:${message.id} CONTENT ${createMessageJSON(message)};
    RELATE user:${message.author.id}->write->message:${message.id} SET time.created = ${message.createdTimestamp}, time.updated = [], history.content += ${JSON.stringify(message.content)};
    RELATE message:${message.id}->inside->channel:${message.channelId} SET time.created = ${message.createdTimestamp}, time.updated = [], history.content += ${JSON.stringify(message.content)};
    `;
    allMessagesTransactions[message.channel.id] = allMessagesTransactions[message.channel.id].concat(transaction);
    //console.timeEnd("new");
}

async function editMessage(message, dbMessage) {
    // let write = (await surreal.query(`
    // SELECT <-write AS write FROM message:${message.id} FETCH write;
    // `));
    //console.log(dbMessage);
    //LET $write = (SELECT <-write.id AS id FROM message:${message.id});
    //console.log(write[0][0].write[0]);

    //UPDATE ${dbMessage.write.id} SET ${JSON.stringify(_messageUpdateFields(message))};

    //UPDATE ${dbMessage.write.id} SET ${updateWriteJSON(message)};

    //console.time("edit");
    // surreal.query(`
    // BEGIN TRANSACTION;
    // UPDATE ${dbMessage.id} MERGE ${updateMessageJSON(message, dbMessage)};
    // UPDATE info:message SET newest.updated.${message.channel.id} = message:${message.id};
    // COMMIT TRANSACTION;
    // `);

    //UPDATE info:message SET newest.updated.${message.channel.id} = message:${message.id};
    
    let transaction = `
    UPDATE ${dbMessage.id} CONTENT ${updateMessageJSON(message, dbMessage)};
    `;
    allMessagesTransactions[message.channel.id] = allMessagesTransactions[message.channel.id].concat(transaction);
    //console.timeEnd("edit");
}

async function deleteMessage(message) {
    await surreal.query(`
    
    `);
    // let query = (await db.query("message", "update", {
    //     where: {
    //         id: message.id
    //     },
    //     data: {
    //         stillAvailable: false
    //     }
    // })).query;
    // db.execute(query);
}

async function reactionEmojiChange(reaction) {
    reaction = await fixReactionEmojiUsers(reaction);
    let query = (await db.query("messageReaction", "upsert", upsertMessageReactionJSON(reaction))).query;
    db.execute(query);
} 

async function getMessageByID(id){
    let message = (await surreal.query(`
    SELECT * FROM message:${id};
    `))[0].result;
    //console.log(message);
    return message.length > 0 ? message[0] : null;
}

async function messageExists(id){
    let message = await getMessageByID(id);
    console.log(message);
    return (typeof message === 'object' && message !== null && Object.keys(message).length == 0) ? true : false;
}

async function getLastMessageIDFromChannel(channel) {
    // let lastMessage = (await surreal.query(`
    // SELECT in, time FROM inside WHERE out = channel:${channel.id} ORDER BY time.created DESC LIMIT 1;
    // `))[0];
    let lastMessage = (await surreal.query(`
    SELECT newest.created.770671267345989644 AS message FROM info:message;
    `))[0].result;
    //console.log(lastMessage);
    //return lastMessage.length > 0 ? lastMessage[0].in.substring(lastMessage[0].in.indexOf(":") + 1) : null;
    return lastMessage.length > 0 ? lastMessage[0].message.substring(lastMessage[0].message.indexOf(":") + 1) : null;
    // let query = (await db.query("message", "findFirst", {
    //     where: {
    //         channelId: channel.id
    //     },
    //     orderBy: {
    //         createdTimestamp: 'desc'
    //     }
    // })).query;
    // return (await db.execute(query)) || {}
}

function upsertMessageJSON(message) {
    return {
        where: {
            id: message.id
        },
        update: updateMessageJSON(message),
        create: createMessageJSON(message)
    };
}

function upsertMemberJSON(member) {
    return {
        where: {
            discordID: member.user.id,
        },
        update: updateMemberJSON(member),
        create: createMemberJSON(member)
    };
}

function updateChannelJSON(channel) {
    return JSON.stringify({
        id: channel.id,
        name: channel.name
    });
}

function createMessageJSON(message) {
    return JSON.stringify({
        id: message.id,
        content: message.content,
        edited: false,
        pinned: message.pinned,
        tts: message.tts,
        stillAvailable: true
    });
}

function updateMessageJSON(message, databaseMessageObject) {
    return JSON.stringify({
        content: message.content,
        edited: true,
        pinned: message.pinned,
        tts: message.tts,
        stillAvailable: true
    });
}

//time.created = ${message.createdTimestamp}, time.updated = [], history.content += ${JSON.stringify(message.content)};

function createWriteJSON(message) {
    return JSON.stringify({
        time: {
            created: message.createdTimestamp,
            updated: [

            ]
        }
    });
}

function updateWriteJSON() {
    return JSON.stringify({
        history: {
            content: [_messageEditsWithContent(0, message.content)]
        }
    });
}

function _generateWriteTimeUpdatedArray(message) {
    //let array = message.write.time.updated;
    //array.push(message.);
    //return 
}

function _messageEditsWithContent(edits, content) {
    return `${edits}:${content}`;
}

function _messageEditsWithTimestamp(edits, timestamp) {
    return `${edits}:${content}`;
}

function _messageEditCount(history) {
    return history.slice(-1).substring(0, history.slice(-1).indexOf(":"));
}

function _messageUpdateFields(message) {
    let edits = _messageEditCount(message.history) + 1;
    return `time.updated += ${JSON.stringify(_messageEditsWithTimestamp(edits, message.editedTimestamp))}, history.content += ${JSON.stringify(_messageEditsWithContent(edits, message.content))};`;
}

function updateMemberJSON(member) {
    return JSON.stringify({
        username: member.user.username,
        displayname: member.nickname || member.user.username,
        discriminator: parseInt(member.user.discriminator),
        avatar: member.avatar || member.user.avatar || ""
    });
}

function createMemberJSON(member, fromMessage) {
    return fromMessage ? {
        discordID: member.author.id,
        username: member.author.username,
        displayname: member.author.username,
        discriminator: parseInt(member.author.discriminator),
        avatar: member.author.avatar || ""
    } : {
        discordID: member.user.id,
        username: member.user.username,
        displayname: member.nickname || member.user.username,
        discriminator: parseInt(member.user.discriminator),
        avatar: member.avatar || member.user.avatar || ""
    };
}

function fixReactionEmoji(reaction) {
    if (!("custom" in reaction._emoji)){
        if (reaction._emoji.id == null) {
            reaction._emoji.realId = getEmojiUnicode(reaction._emoji.name).replace(/\s+/g, '-');
            reaction._emoji.realName = Object.keys(emojiNameMap.emoji).find(key => emojiNameMap.emoji[key] === reaction._emoji.name) || null;
            reaction._emoji.custom = false;
            reaction._emoji.image = `https://raw.githubusercontent.com/twitter/twemoji/master/assets/svg/${reaction._emoji.realId}.svg`;
        } else {
            reaction._emoji.realId = reaction._emoji.id
            reaction._emoji.realName = reaction._emoji.name;
            reaction._emoji.custom = true;
            reaction._emoji.image = `https://cdn.discordapp.com/emojis/${reaction._emoji.realId}`;
        }
        if (reaction._emoji.animated == null || reaction._emoji.animated == false) {
            reaction._emoji.isAnimated = false;
        } else {
            reaction._emoji.isAnimated = true;
        }
        reaction.count = reaction.count || 0;
    }
    return reaction;
}

async function fixReactionEmojiUsers(reaction) {
    const usersMap = (await reaction.users.fetch()).values();
    const users = [];
    const userIds = [];
    for (const user of usersMap) {
        users.push(user);
        userIds.push({
            id: user.id
        });
    }
    reaction.userArray = users;
    reaction.userIds = userIds;
    return reaction;
}

function upsertMessageReactionJSON(reaction) {
    reaction = fixReactionEmoji(reaction);
    return {
        where: {
            id: `${reaction.message.id}[${reaction._emoji.realId}]`
        },
        update: updateMessageReactionJSON(reaction),
        create: createMessageReactionJSON(reaction)
    };
}

function updateMessageReactionJSON(reaction) {
    reaction = fixReactionEmoji(reaction);
    return {
        reactionCount: reaction.count,
        users: {
            set: reaction.userIds
        }
    };
}

function createMessageReactionJSON(reaction) {
    reaction = fixReactionEmoji(reaction);
    return {
        id: `${reaction.message.id}[${reaction._emoji.realId}]`,
        reaction: {
            connectOrCreate: {
                where: {
                    id: reaction._emoji.realId
                },
                create: createReactionEmojiJSON(reaction)
            }
        },
        reactionCount: reaction.count,
        message: {
            connectOrCreate: {
                where: {
                    id: reaction.message.id
                },
                create: createMessageJSON(reaction.message)
            }
        },
        users: {
            connect: reaction.userIds
        }
    };
}

function upsertReactionEmojiJSON(reaction) {
    reaction = fixReactionEmoji(reaction);
    return {
        where: {
            id: reaction._emoji.realId,
        },
        update: updateReactionEmojiJSON(reaction),
        create: createReactionEmojiJSON(reaction)
    };
}

function updateReactionEmojiJSON(reaction) {
    reaction = fixReactionEmoji(reaction);
    return {
        name: reaction._emoji.realName,
        custom: reaction._emoji.custom,
        animated: reaction._emoji.isAnimated,
        image: reaction._emoji.image
    };
}

function createReactionEmojiJSON(reaction) {
    reaction = fixReactionEmoji(reaction);
    return {
        id: reaction._emoji.realId,
        name: reaction._emoji.realName,
        custom: reaction._emoji.custom,
        animated: reaction._emoji.isAnimated,
        image: reaction._emoji.image
    };
}

module.exports = {
    connect, newMessage, editMessage, upsertMessage, deleteMessage, reactionEmojiChange, syncChannels, syncMembers, fullSync, messageCreate
}