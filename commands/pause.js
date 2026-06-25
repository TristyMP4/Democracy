const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or resume the current song.'),

    async execute(interaction) {
        const channel = interaction.member.voice?.channel;

        if (!channel) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription('❌ You must be in a voice channel.')
                ],
                ephemeral: true
            });
        }

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

        const wasPaused = queue.node.isPaused();
        queue.node.setPaused(!wasPaused);

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(wasPaused ? 0x2ecc71 : 0xf1c40f)
                    .setDescription(
                        wasPaused
                            ? `▶️ Resumed **${queue.currentTrack.title}**.`
                            : `⏸️ Paused **${queue.currentTrack.title}**.`
                    )
            ]
        });
    }
};
