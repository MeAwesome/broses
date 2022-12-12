const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("admin")
        .setDescription("Broses Bot Admin Commands")
        .addSubcommand(subcommand =>
            subcommand
                .setName('fullsync')
                .setDescription('Preform a full database sync')
        ),
    async execute(interaction) {
        if (interaction.user.id == "564597179910586369"){
            if (interaction.options.getSubcommand() === 'fullsync') {
                const channels = await discord.getChannels();
                let channel;
                for(let c of channels){
                    if(c.id == interaction.channelId){
                        channel = c;
                    }
                }
                await interaction.reply({ content: "A fullsync has begun", ephemeral: false });
                await database.fullSync();
                channel.send('FullSync Completed');
            } else {
                await interaction.reply({ content: "Unknown Command", ephemeral: true });
            }
        } else {
            await interaction.reply({ content: "You don't have access to this feature! Mald!", ephemeral: false });
        }
    }
};