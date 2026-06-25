const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useQueue } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the playback volume.')
        .addIntegerOption(option =>
            option
                .setName('level')
                .setDescription('Volume level (0-100)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100)
        ),

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

        const level = interaction.options.getInteger('level');
        queue.node.setVolume(level);

        let emoji;
        if (level === 0) emoji = '🔇';
        else if (level <= 30) emoji = '🔈';
        else if (level <= 70) emoji = '🔉';
        else emoji = '🔊';

        return interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x5865f2)
                    .setDescription(`${emoji} Volume set to **${level}%**.`)
            ]
        });
    }
};
