const { SlashCommandBuilder } = require('discord.js');
const VoteManager = require('../../utils/VoteManager.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    owner: true,
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Start a highly customizable server-wide poll in the Breaking News channel.')
        .addStringOption(option => option.setName('title').setDescription('The title of the poll').setRequired(true))
        .addStringOption(option => option.setName('description').setDescription('The detailed description of what is being voted on').setRequired(true))
        .addIntegerOption(option => option.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(1440))
        .addStringOption(option => option.setName('option1_label').setDescription('Label for the first button (e.g. Yes)').setRequired(true))
        .addStringOption(option => option.setName('option2_label').setDescription('Label for the second button (e.g. No)').setRequired(true))
        .addStringOption(option => option.setName('ping').setDescription('Who to ping when the poll starts').addChoices(
            { name: 'Everyone', value: 'everyone' },
            { name: 'Here', value: 'here' },
            { name: 'None', value: 'none' }
        ))
        .addNumberOption(option => option.setName('required_percentage').setDescription('Percentage required to pass (0.0 to 1.0, default 0.5)').setMinValue(0.01).setMaxValue(1.0))
        .addStringOption(option => option.setName('option1_emoji').setDescription('Emoji for the first button'))
        .addStringOption(option => option.setName('option2_emoji').setDescription('Emoji for the second button'))
        .addBooleanOption(option => option.setName('require_online').setDescription('Calculate required votes based strictly on online members (default false)')),

    async execute(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const durationMinutes = interaction.options.getInteger('duration');
        const option1Label = interaction.options.getString('option1_label');
        const option2Label = interaction.options.getString('option2_label');
        const pingType = interaction.options.getString('ping') || 'here';
        const requiredPercentage = interaction.options.getNumber('required_percentage') || 0.5;
        const requireOnline = interaction.options.getBoolean('require_online') || false;
        const option1Emoji = interaction.options.getString('option1_emoji');
        const option2Emoji = interaction.options.getString('option2_emoji');

        // Fetch news channel
        let newsChannel = null;
        if (EconomyConfig.newsChannelId) {
            newsChannel = await interaction.guild.channels.fetch(EconomyConfig.newsChannelId).catch(() => null);
        }

        if (!newsChannel) {
            return interaction.reply(ComponentUtils.createError('No Breaking News channel configured in EconomyConfig!'));
        }

        const durationMs = durationMinutes * 60000;

        // Fire and forget, VoteManager handles the replies and end states
        VoteManager.startVote(interaction, {
            title: title,
            description: description,
            requiredPercentage: requiredPercentage,
            duration: durationMs,
            requireOnline: requireOnline,
            pingType: pingType,
            yesLabel: option1Label,
            noLabel: option2Label,
            yesEmoji: option1Emoji,
            noEmoji: option2Emoji,
            channel: newsChannel
        }).then(result => {
            if (result) {
                // Display final result in the news channel
                VoteManager.displayResult(result.message, {
                    passed: result.passed,
                    title: title,
                    description: description,
                    yesVotes: result.yesVotes,
                    noVotes: result.noVotes,
                    requiredVotes: result.requiredVotes
                });
            }
        });
    }
};
