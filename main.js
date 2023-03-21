const path = require("path");
const fs = require("fs");
const { CLIENT_ID, TOKEN, GUILD_ID } = require("./settings.json");
const { Client, GatewayIntentBits, Collection, REST, Routes, Partials } = require('discord.js');
const rest = new REST({ version: '10' }).setToken(TOKEN);
const { PrismaClient, prisma } = require('@prisma/client');
const { getGuild } = require("./util/discord.js");
global.client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});
global.prisma = new PrismaClient();
global.discord = require("./util/discord.js");
global.database = require("./util/database.js");

/*
emoji css
img {
  vertical-align: bottom;
  object-fit: certain;
  width: 1.375em;
  height: 1.375em;
}
*/

async function initializeCommands(){
    try {
        console.log('Started refreshing application (/) commands.');

        client.commands = new Collection();

        const commandsPath = path.join(__dirname, 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        const restCommands = [];

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                restCommands.push(command.data.toJSON());
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }

        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: restCommands });

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
}

async function main(){
    await initializeCommands();

    client.on('ready', async () => {
        console.log(`Logged in as ${client.user.tag}!`);

        discord.setGuild(GUILD_ID);

        //await global.prisma.messageReaction.deleteMany({});
        //await global.prisma.reactionEmoji.deleteMany({});

        await database.connect();
        await database.syncMembers();
        await database.syncChannels();

        // fs.writeFileSync('broses.cache', JSON.stringify(getGuild(GUILD_ID)), function (err) {
        //     if (err) throw err;
        //     console.log('Saved!');
        // });
    });

    client.on("messageCreate", async (message) => {
        database.messageCreate(message);
    });

    client.on('messageUpdate', async (oldMessage, newMessage) => {
        database.upsertMessage(newMessage);
    });
    
    client.on('messageDelete', async (message) => {
        database.deleteMessage(message);
    });

    // client.on('messageReactionAdd', async (reaction, user) => {
    //     const message = !reaction.message.author ? await reaction.message.fetch() : reaction.message;
    //     reaction = message.reactions.cache.get(reaction._emoji.id || reaction._emoji.name) || reaction;
    //     database.reactionEmojiChange(reaction);
    // });

    // client.on("messageReactionRemove", async (reaction, user) => {
    //     const message = !reaction.message.author ? await reaction.message.fetch() : reaction.message;
    //     reaction = message.reactions.cache.get(reaction._emoji.id || reaction._emoji.name) || reaction;
    //     database.reactionEmojiChange(reaction);
    // });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
        }
    });
    
    client.login(TOKEN);
}

main();