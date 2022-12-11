const path = require("path");
const fs = require("fs");
global.discord = require("./util/discord.js");
global.database = require("./util/database.js");
const { CLIENT_ID, TOKEN, GUILD_ID } = require("./settings.json");
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
global.client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ] });
const rest = new REST({ version: '10' }).setToken(TOKEN);
const { PrismaClient } = require('@prisma/client');
global.prisma = new PrismaClient();

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

        //await prisma.message.deleteMany({});

        await database.syncMembers();
        await database.syncChannels();

        // client.channels.cache.get("868331388007485440").messages.fetch("868331756259012648")
        //     .then(message => console.log(message))
        //     .catch(console.error);
    });

    client.on("messageCreate", async (message) => {
        database.newMessage(message);
    })

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
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    });

    client.login(TOKEN);
}

main();