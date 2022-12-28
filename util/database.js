const db = require("./database/prismaHelper.js");

let allMessages = {};
//const syncedChannels = {};

async function fullSync() {
    console.log("\n--STARTING FULLSYNC--\n ! This will take a while ! \n");
    console.time("fullsync");
    await syncMembers();
    let query = (await db.query("message", "updateMany", {
        data: {
            stillAvailable: false
        }
    })).query;
    await db.execute(query);
    await syncChannels(true);
    console.timeEnd("fullsync");
    console.log("\n--FULLSYNC COMPLETE--\n");
}

async function syncMembers() {
    console.log("\n--STARTING MEMBER SYNC--\n");
    const members = await discord.getMembers();
    for (let member of members) {
        await syncMember(member);
    }
    console.log("\n--ALL MEMBERS SYNCED--\n");
}

async function syncChannels(force) {
    console.log("\n--STARTING CHANNEL SYNC--\n");
    const channels = await discord.getChannels();
    const promises = [];
    for (let channel of channels) {
        allMessages[channel.id] = [];
        //syncedChannels[channel.id] = false;
        promises.push(syncChannel(channel, force));
    }
    await Promise.all(promises);
    console.log("All channels ready for upgrades");
    for (let channelMessages of Object.values(allMessages).filter((messages) => messages.length > 0)) {
        console.time("transaction");
        let transaction = (await db.transaction(channelMessages)).transaction;
        await db.execute(transaction);
        console.timeEnd("transaction");
    }
    allMessages = {};
    console.log("\n--ALL CHANNELS SYNCED--\n ! A FullSync might still be required if messages were edited or deleted while the bot was offline ! \n");
}

async function syncMember(member) {
    let query = (await db.query("user", "upsert", upsertMemberJSON(member))).query;
    await db.execute(query);
    console.log(`${member.user.username} in sync!`);
}

async function syncChannel(channel, force) {
    return new Promise(async (resolve, reject) => {
        let lastMessageStored = await getLastMessageFromChannel(channel);
        let lastId = null;
        let size = 100;
        let lastMessageReached = false;
        if ((lastMessageStored.id !== channel.lastMessageId) || force) {
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
                    if (message.id == lastMessageStored.id && !force) {
                        lastMessageReached = true;
                        break;
                    }
                    let query = (await db.query("message", "upsert", upsertMessageJSON(message))).query;
                    //console.log(query);
                    allMessages[channel.id].push(query);//prisma.message.upsert(upsertMessageJSON(message)));
                    //db.execute(query);
                }
                lastId = messages.last().id;
                //console.log(`${channel.name}: ${allMessages[channel.id].length}`);
                size = lastMessageReached ? 0 : messages.size;
            }
            //console.log("beginning transaction for " + channel.name + " " + allMessages[channel.id]);
            //console.log(allMessages[channel.id]);
            //let transaction = (await db.transaction(allMessages[channel.id])).transaction;
            //await db.execute(transaction);
            //syncedChannels[channel.id] = true;
            console.log(`${channel.name} is ready for upgrades`);
            //resolve();

            // const transactions = [];
            // while (size == 100) {
            //     const messages = await discord.getMessages(channel, {
            //         limit: 100,
            //         before: lastId
            //     });
            //     if (!messages.last()) {
            //         break;
            //     }
            //     const messageValues = messages.values();
            //     for(const message of messageValues){
            //         if (message.id == lastMessageStored.id && !force) {
            //             lastMessageReached = true;
            //             break;
            //         }
            //         transactions.push(prisma.message.upsert(upsertMessageJSON(message)));
            //         //await db.execute(prisma.message.upsert(upsertMessageJSON(message)), test++);
            //     }
            //     lastId = messages.last().id;
            //     size = lastMessageReached ? 0 : messages.size;
            //     console.log(transactions.length);
            // }
            // console.log("starting transactions");
            // await db.execute(prisma.$transaction(transactions));
        }
        //syncedChannels.push(channel.id);
        //console.log(`${channel.name} in sync!`);
        resolve();
    });
}

async function newMessage(message) {
    //console.log(message);
    // if (syncedChannels.indexOf(message.channelId) < 0) {
    //     return;
    // }
    let query = (await db.query("message", "create", {
        data: createMessageJSON(message)
    })).query;
    db.execute(query);
}

async function editMessage(oldMessage, newMessage) {
    // if (syncedChannels.indexOf(oldMessage.channelId) < 0) {
    //     return;
    // }
    let query = (await db.query("message", "update", {
        where: {
            id: oldMessage.id
        },
        data: updateMessageJSON(newMessage)
    })).query;
    db.execute(query);
}

async function deleteMessage(message) {
    // if (syncedChannels.indexOf(message.channelId) < 0) {
    //     return;
    // }
    let query = (await db.query("message", "update", {
        where: {
            id: message.id
        },
        data: {
            stillAvailable: false
        }
    })).query;
    db.execute(query);
}

async function getLastMessageFromChannel(channel) {
    let query = (await db.query("message", "findFirst", {
        where: {
            channelId: channel.id
        },
        orderBy: {
            createdTimestamp: 'desc'
        }
    })).query;
    return (await db.execute(query)) || {}
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
            id: member.user.id,
        },
        update: updateMemberJSON(member),
        create: createMemberJSON(member)
    };
}

function updateMessageJSON(message) {
    return {
        content: message.content,
        pinned: message.pinned,
        tts: message.tts,
        stillAvailable: true
    }
}

function createMessageJSON(message) {
    return {
        id: message.id,
        channelId: message.channelId,
        guildId: message.guildId,
        createdTimestamp: new Date(message.createdTimestamp),
        author: {
            connectOrCreate: {
                where: {
                    id: message.author.id
                },
                create: createMemberJSON(message, true)
            }
        },
        content: message.content,
        pinned: message.pinned,
        tts: message.tts,
        stillAvailable: true
    };
}

function updateMemberJSON(member) {
    return {
        username: member.user.username,
        displayname: member.nickname || member.user.username,
        discriminator: parseInt(member.user.discriminator),
        avatar: member.avatar || member.user.avatar || ""
    };
}

function createMemberJSON(member, fromMessage) {
    return fromMessage ? {
        id: member.author.id,
        username: member.author.username,
        displayname: member.author.username,
        discriminator: parseInt(member.author.discriminator),
        avatar: member.author.avatar || ""
    } : {
        id: member.user.id,
        username: member.user.username,
        displayname: member.nickname || member.user.username,
        discriminator: parseInt(member.user.discriminator),
        avatar: member.avatar || member.user.avatar || ""
    };
}

module.exports = {
    newMessage, editMessage, deleteMessage, syncChannels, syncMembers, fullSync
}