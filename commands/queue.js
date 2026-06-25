const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('View the current music queue.'),

    async execute(interaction) {
        const queue = useQueue(interaction.guild.id);

        if (!queue || !queue.isPlaying()) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription('❌ Nothing is currently playing.')
                ],
                ephemeral: true
            });
        }

        const currentTrack = queue.currentTrack;
        const tracks = queue.tracks.toArray();
        const totalPages = Math.max(1, Math.ceil(tracks.length / 10));
        let page = 0;

        function buildEmbed(pageNum) {
            const start = pageNum * 10;
            const end = start + 10;
            const pageTracks = tracks.slice(start, end);

            const lines = [
                `🎶 **Now Playing:** [${currentTrack.title}](${currentTrack.url}) — \`${currentTrack.duration}\``,
                `> Requested by ${currentTrack.requestedBy || 'Unknown'}`,
                ''
            ];

            if (tracks.length === 0) {
                lines.push('*No more songs in the queue.*');
            } else {
                pageTracks.forEach((track, i) => {
                    lines.push(
                        `**${start + i + 1}.** [${track.title}](${track.url}) — \`${track.duration}\`\n` +
                        `> Requested by ${track.requestedBy || 'Unknown'}`
                    );
                });
            }

            return new EmbedBuilder()
                .setTitle('📋 Music Queue')
                .setColor(0x5865f2)
                .setDescription(lines.join('\n'))
                .setFooter({
                    text: `Page ${pageNum + 1}/${totalPages} • ${tracks.length} song${tracks.length === 1 ? '' : 's'} in queue`
                })
                .setTimestamp();
        }

        function buildRow(pageNum) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('queue_prev')
                    .setLabel('◀')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageNum === 0),
                new ButtonBuilder()
                    .setCustomId('queue_next')
                    .setLabel('▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(pageNum >= totalPages - 1)
            );
        }

        const components = totalPages > 1 ? [buildRow(page)] : [];

        await interaction.reply({
            embeds: [buildEmbed(page)],
            components
        });

        if (totalPages <= 1) return;

        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ time: 60_000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setDescription('❌ Only the person who ran this command can navigate.')
                    ],
                    ephemeral: true
                });
            }

            if (i.customId === 'queue_prev') page = Math.max(0, page - 1);
            if (i.customId === 'queue_next') page = Math.min(totalPages - 1, page + 1);

            await i.update({
                embeds: [buildEmbed(page)],
                components: [buildRow(page)]
            });
        });

        collector.on('end', async () => {
            await message.edit({ components: [] }).catch(() => {});
        });
    }
};
