const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show details about the currently playing song.'),

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

        const track = queue.currentTrack;
        const isPaused = queue.node.isPaused();

        // Build a progress bar — falls back gracefully if unavailable
        let progressLine;
        try {
            const progress = queue.node.createProgressBar();
            progressLine = progress || 'N/A';
        } catch {
            progressLine = 'N/A';
        }

        const embed = new EmbedBuilder()
            .setTitle(`${isPaused ? '⏸️' : '🎶'} Now Playing`)
            .setDescription(`[**${track.title}**](${track.url})`)
            .addFields(
                { name: '👤 Artist', value: track.author || 'Unknown', inline: true },
                { name: '⏱️ Duration', value: track.duration || 'Live', inline: true },
                { name: '🎧 Requested by', value: `${track.requestedBy || 'Unknown'}`, inline: true },
                { name: '📊 Progress', value: progressLine }
            )
            .setColor(isPaused ? 0xf1c40f : 0x5865f2)
            .setTimestamp();

        if (track.thumbnail) embed.setThumbnail(track.thumbnail);
        if (isPaused) embed.setFooter({ text: '⏸️ Playback is paused' });

        return interaction.reply({ embeds: [embed] });
    }
};
