const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { useMainPlayer, QueryType } = require('discord-player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Search for a song and pick which one to play from the results.')
        .addStringOption(option =>
            option
                .setName('query')
                .setDescription('Song name to search for')
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
            // Step 1: Search for the track
            const searchResult = await player.search(query, {
                requestedBy: interaction.user,
                searchEngine: QueryType.SOUNDCLOUD_SEARCH
            });

            if (!searchResult || !searchResult.tracks.length) {
                return interaction.followUp({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setDescription(`❌ No results found for "${query}" on SoundCloud.`)
                    ]
                });
            }

            // If it's a direct playlist link, just play it immediately without selection
            if (searchResult.playlist) {
                const result = await player.play(channel, searchResult, {
                    nodeOptions: {
                        metadata: { channel: interaction.channel, requestedBy: interaction.user },
                        leaveOnEmpty: true, leaveOnEmptyCooldown: 30000,
                        leaveOnEnd: true, leaveOnEndCooldown: 30000,
                    },
                    requestedBy: interaction.user
                });

                if (result.queue?.metadata) result.queue.metadata.lastPlayCommand = Date.now();
                const embed = new EmbedBuilder()
                    .setTitle('🎵 Playlist Added')
                    .setDescription(`[**${searchResult.playlist.title}**](${searchResult.playlist.url}) (${searchResult.tracks.length} tracks)`)
                    .setColor(0x5865f2)
                    .setTimestamp();
                return interaction.followUp({ embeds: [embed] });
            }

            // Step 2: Grab top 10 tracks and make a dropdown
            const topTracks = searchResult.tracks.slice(0, 10);
            const options = topTracks.map((track, i) => {
                let label = track.title;
                if (label.length > 95) label = label.substring(0, 95) + '...';
                let description = `By ${track.author} • ${track.duration}`;
                if (description.length > 95) description = description.substring(0, 95) + '...';

                return {
                    label: label,
                    description: description,
                    value: i.toString() // We use the array index as the value
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_track')
                .setPlaceholder('Select a song to play')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setColor(0x2b2d31)
                .setDescription(`🔍 Found **${topTracks.length}** results for \`${query}\`.\nPlease select the exact track you want from the menu below:`);

            const msg = await interaction.followUp({
                embeds: [embed],
                components: [row],
                fetchReply: true
            });

            // Step 3: Wait for user selection
            const filter = i => i.user.id === interaction.user.id && i.customId === 'select_track';
            const collector = msg.createMessageComponentCollector({
                filter,
                componentType: ComponentType.StringSelect,
                time: 60000 // 60 seconds to pick
            });

            collector.on('collect', async i => {
                // Defer the update so the interaction doesn't fail
                await i.deferUpdate();
                collector.stop('selected');

                const selectedIndex = parseInt(i.values[0]);
                const selectedTrack = topTracks[selectedIndex];

                // Play the selected track
                try {
                    const result = await player.play(channel, selectedTrack, {
                        nodeOptions: {
                            metadata: { channel: interaction.channel, requestedBy: interaction.user },
                            leaveOnEmpty: true, leaveOnEmptyCooldown: 30000,
                            leaveOnEnd: true, leaveOnEndCooldown: 30000,
                        },
                        requestedBy: interaction.user
                    });

                    if (result.queue?.metadata) result.queue.metadata.lastPlayCommand = Date.now();

                    const successEmbed = new EmbedBuilder()
                        .setTitle('🎵 Added to Queue')
                        .setDescription(`[**${selectedTrack.title}**](${selectedTrack.url})`)
                        .addFields(
                            { name: '👤 Artist', value: selectedTrack.author || 'Unknown', inline: true },
                            { name: '⏱️ Duration', value: selectedTrack.duration || 'Live', inline: true },
                            { name: '🎧 Requested by', value: `${interaction.user}`, inline: true }
                        )
                        .setColor(0x5865f2)
                        .setTimestamp();
                    if (selectedTrack.thumbnail) successEmbed.setThumbnail(selectedTrack.thumbnail);

                    // Edit original message to remove dropdown and show success
                    await msg.edit({ embeds: [successEmbed], components: [] });
                } catch (err) {
                    await msg.edit({
                        embeds: [
                            new EmbedBuilder().setColor(0xe74c3c).setDescription(`❌ Failed to play track.\n\`\`\`${err.message}\`\`\``)
                        ],
                        components: []
                    });
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason !== 'selected') {
                    // Timeout or other ending
                    selectMenu.setDisabled(true);
                    await msg.edit({ components: [new ActionRowBuilder().addComponents(selectMenu)] }).catch(() => {});
                }
            });

        } catch (error) {
            return interaction.followUp({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription(`❌ Could not search for that track.\n\`\`\`${error.message}\`\`\``)
                ]
            });
        }
    }
};
