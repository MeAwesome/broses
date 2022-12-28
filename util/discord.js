const { ChannelType } = require("discord.js");

let defaultGuildId;
let defaultGuild;

function setGuild(guildId) {
    defaultGuildId = guildId;
    defaultGuild = getGuildRaw(guildId);
}

function getGuild(guildId) {
    setGuild(guildId);
    return defaultGuild;
}

async function getMembers() {
    return (await getMembersRaw(defaultGuild)).values();
}

async function getChannels() {
    return (await getChannelsRaw(defaultGuild)).filter(channel => channel.type == ChannelType.GuildText).values();
}

async function getMessages(channel, options) {
    return (await getMessagesRaw(channel, options))//.values();
}

function getGuildRaw(guildId) {
    return client.guilds.resolve(guildId);
}

async function getMembersRaw(guild) {
    return await guild.members.fetch();
}

async function getChannelsRaw(guild) {
    return await guild.channels.fetch();
}

async function getMessagesRaw(channel, options) {
    return await channel.messages.fetch(options);
}

module.exports = {
    setGuild, getGuild, getMembers, getChannels, getMessages
}