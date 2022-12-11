async function syncChannel(channel, force) {
    let lastMessageStored = await getLastMessageFromChannel(channel) || {};
    let lastId = null;
    let size = 100;
    if((lastMessageStored.id !== channel.lastMessageId) || force) {
        while(size == 100){
            const messages = await discord.getMessages(channel, {
                limit: 100,
                before: lastId
            });
            if (!messages.last()) {
                break;
            }
            const transactions = [];
            messages.forEach(message => {
                transactions.push(prisma.message.upsert({
                    where: {
                        id: message.id
                    },
                    update: {
                        content: message.content,
                        pinned: message.pinned,
                        tts: message.tts
                    },
                    create: {
                        id: message.id,
                        channelId: message.channelId,
                        guildId: message.guildId,
                        createdTimestamp: new Date(message.createdTimestamp),
                        author: {
                            connectOrCreate: {
                                where: {
                                    id: message.author.id
                                },
                                create: {
                                    id: message.author.id,
                                    username: message.author.username,
                                    displayname: message.author.username,
                                    discriminator: parseInt(message.author.discriminator),
                                    avatar: message.author.avatar || ""
                                }
                            }
                        },
                        content: message.content,
                        pinned: message.pinned,
                        tts: message.tts
                    }
                }));
            });
            await prisma.$transaction(transactions);
            lastId = messages.last().id;
            size = messages.size;
        }
    }
    console.log(`${channel.name} - DONE!`);
}

async function newMessage(message) {
    //console.log(message);
    await prisma.message.create({
        data: {
            id: message.id,
            channelId: message.channelId,
            guildId: message.guildId,
            createdTimestamp: new Date(message.createdTimestamp),
            author: {
                connect: {
                    id: message.author.id
                }
            },
            content: message.content,
            pinned: message.pinned,
            tts: message.tts
        }
    });
}

async function getLastMessageFromChannel(channel) {
    return await prisma.message.findFirst({
        where: {
            channelId: channel.id
        },
        orderBy: {
            createdTimestamp: 'desc'
        }
    })
}

module.exports = {
    newMessage, getLastMessageFromChannel, syncChannel
}