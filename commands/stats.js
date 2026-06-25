const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

const Stat = require('../schemas/stats');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View stats for a user.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to view stats for')
                .setRequired(false)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const data = await Stat.findOne({ userId: user.id });

        if (user.bot) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription('❌ You cannot view stats for bots.')
                ],
                ephemeral: true
            });
        }

        if (!data) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription(`❌ No stats found for **${user.tag}**.`)
                ],
                ephemeral: true
            });
        }

        const votemutes = data.votemutes;
        const votekicks = data.votekicks;

        const embed = new EmbedBuilder()
            .setTitle(`📊 Voting Stats - ${user.tag}`)
            .setColor(0x5865f2)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                {
                    name: '🔇 Votemutes',
                    value:
                        `Initiated: **${votemutes.initiated}**\n` +
                        `Passed: **${votemutes.passed}**\n` +
                        `Failed: **${votemutes.failed}**\n` +
                        `Received: **${votemutes.received}**`,
                    inline: true
                },
                {
                    name: '🛑 Votekicks',
                    value:
                        `Initiated: **${votekicks.initiated}**\n` +
                        `Passed: **${votekicks.passed}**\n` +
                        `Failed: **${votekicks.failed}**\n` +
                        `Received: **${votekicks.received}**`,
                    inline: true
                }
            )
            .setFooter({ text: 'Vote statistics' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`view_history_${user.id}`)
                .setLabel('View Vote History')
                .setStyle(ButtonStyle.Secondary)
        );
        return interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }
};