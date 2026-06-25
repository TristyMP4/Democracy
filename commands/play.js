const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { useMainPlayer } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or add it to the queue.')
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('Song name or URL (SoundCloud, Spotify, etc.)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const channel = interaction.member.voice?.channel;

        if (!channel) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription('❌ You must be in a voice channel to play music.')
                ],
                ephemeral: true
            });
        }

        // Check bot has permission to join and speak
        const permissions = channel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has('Connect') || !permissions.has('Speak')) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription('❌ I need **Connect** and **Speak** permissions in that voice channel.')
                ],
                ephemeral: true
            });
        }

        const query = interaction.options.getString('query');
        const player = useMainPlayer();

        await interaction.deferReply();

        try {
            const result = await player.play(channel, query, {
                searchEngine: 'com.retrouser955.discord-player.discord-player-youtubei',
                nodeOptions: {
                    metadata: {
                        channel: interaction.channel,
                        requestedBy: interaction.user
                    },
                    leaveOnEmpty: true,
                    leaveOnEmptyCooldown: 30_000,
                    leaveOnEnd: true,
                    leaveOnEndCooldown: 30_000,
                },
                requestedBy: interaction.user
            });

            // Suppress the duplicate "Now Playing" from MusicEvents
            // (this command already responds with track info)
            if (result.queue?.metadata) {
                result.queue.metadata.lastPlayCommand = Date.now();
            }

            const track = result.track;

            const embed = new EmbedBuilder()
                .setTitle('🎵 Added to Queue')
                .setDescription(`[**${track.title}**](${track.url})`)
                .addFields(
                    { name: '👤 Artist', value: track.author || 'Unknown', inline: true },
                    { name: '⏱️ Duration', value: track.duration || 'Live', inline: true },
                    { name: '🎧 Requested by', value: `${interaction.user}`, inline: true }
                )
                .setColor(0x5865f2)
                .setTimestamp();

            if (track.thumbnail) embed.setThumbnail(track.thumbnail);

            return interaction.followUp({ embeds: [embed] });
        } catch (error) {
            return interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription(`❌ Could not play that track.\n\`\`\`${error.message}\`\`\``)
                ]
            });
        }
    }
};
