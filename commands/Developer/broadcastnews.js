const { SlashCommandBuilder } = require('discord.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    owner: true,
    data: new SlashCommandBuilder()
        .setName('broadcastnews')
        .setDescription('Manually send a Breaking News alert.')
        .addStringOption(option => 
            option.setName('title')
                .setDescription('The header/title of the news event')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('content')
                .setDescription('The content of the news event')
                .setRequired(true)
        ),
        
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const title = interaction.options.getString('title');
        const content = interaction.options.getString('content');

        await EconomyUtils.postNewsEvent(
            interaction.guild,
            `## ${title}\n${content}`,
            '#f1c40f', // Gold color for announcements
            '@everyone' // Ping everyone for manual broadcasts
        );

        return interaction.followUp({ content: '✅ Broadcast sent!' });
    }
};
