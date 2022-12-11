const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("wrapped")
        .setDescription("Spotify Wrapped clone for The Broses Discord server"),
    async execute(interaction) {
        await interaction.reply({ content: "Broses Wrapped isn't ready yet. Check back soon", ephemeral: true });
    }
};