const syncedChannels = [];

async function fullSync() {
    console.log("\n--STARTING FULLSYNC--\n ! This will take a while ! \n");
    await syncMembers();
    await prisma.message.updateMany({
        data: {
            stillAvailable: false
        }
    });
    await syncChannels(true);
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
    for (let channel of channels) {
        await syncChannel(channel, force);
    }
    console.log("\n--ALL CHANNELS SYNCED--\n ! A FullSync might still be required if messages were edited or deleted while the bot was offline ! \n");
}

async function syncMember(member) {
    await prisma.user.upsert(upsertMemberJSON(member));
    console.log(`${member.user.username} in sync!`);
}

async function syncChannel(channel, force) {
    let lastMessageStored = await getLastMessageFromChannel(channel);
    let lastId = null;
    let size = 100;
    let lastMessageReached = false;
    if ((lastMessageStored.id !== channel.lastMessageId) || force) {
        while (size == 100) {
            const messages = await discord.getMessages(channel, {
                limit: 100,
                before: lastId
            });
            if (!messages.last()) {
                break;
            }
            const transactions = [];
            messages.forEach(message => {
                if (message.id == lastMessageStored.id && !force) {
                    lastMessageReached = true;
                }
                transactions.push(prisma.message.upsert(upsertMessageJSON(message)));
            });
            await prisma.$transaction(transactions);
            lastId = messages.last().id;
            size = lastMessageReached ? 0 : messages.size;
        }
    }
    syncedChannels.push(channel.id);
    console.log(`${channel.name} in sync!`);
}

async function newMessage(message) {
    //console.log(message);
    if (syncedChannels.indexOf(message.channelId) < 0) {
        return;
    }
    await prisma.message.create({
        data: createMessageJSON(message)
    });
}

async function editMessage(oldMessage, newMessage) {
    if (syncedChannels.indexOf(oldMessage.channelId) < 0) {
        return;
    }
    await prisma.message.update({
        where: {
            id: oldMessage.id
        },
        data: updateMessageJSON(newMessage)
    });
}

async function deleteMessage(message) {
    if (syncedChannels.indexOf(message.channelId) < 0) {
        return;
    }
    await prisma.message.update({
        where: {
            id: message.id
        },
        data: {
            stillAvailable: false
        }
    });
}

async function getLastMessageFromChannel(channel) {
    return (await prisma.message.findFirst({
        where: {
            channelId: channel.id
        },
        orderBy: {
            createdTimestamp: 'desc'
        }
    })) || {}
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