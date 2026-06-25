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
        .setName('stop')
        .setDescription('Start a vote to stop the music and clear the queue.'),

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

        // Count non-bot listeners in the voice channel
        const getListenerCount = () => channel.members.filter(m => !m.user.bot).size;
        const listenerCount = getListenerCount();

        // If 2 or fewer people, stop instantly — no vote needed
        if (listenerCount <= 2) {
            queue.delete();
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2ecc71)
                        .setDescription('⏹️ Stopped the music and cleared the queue.')
                ]
            });
        }

        // ── Vote to Stop ──────────────────────────────────────────────
        const yesVotes = new Set();
        const noVotes = new Set();

        const voteDuration = 30_000;
        const voteDurationString = `<t:${Math.floor((Date.now() + voteDuration) / 1000)}:R>`;
        const requiredPercentage = 0.5;
        const requiredVotes = Math.ceil(listenerCount * requiredPercentage);

        const embed = new EmbedBuilder()
            .setTitle('🗳️ Vote Stop')
            .setColor(0xf1c40f)
            .setDescription(
                [
                    `Started by: ${interaction.user}`,
                    '> A stop vote has been started.',
                    `> If **50%** of listeners vote **Yes**, the music will be **stopped** and the queue **cleared**.`,
                    '',
                    `*Required Votes:* ***${requiredVotes}***`,
                    `*Listeners:* **${listenerCount}**`,
                    `**Voting ends** ${voteDurationString}`
                ].join('\n')
            )
            .addFields(
                { name: 'Yes', value: '0', inline: true },
                { name: 'No', value: '0', inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('vote_yes')
                .setLabel('Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('vote_no')
                .setLabel('No')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('vote_list')
                .setLabel('Votes')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });

        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            time: voteDuration
        });

        collector.on('collect', async buttonInteraction => {
            // ── Votes list ────────────────────────────────────────────
            if (buttonInteraction.customId === 'vote_list') {
                const yesUsers = [...yesVotes].map(id => `<@${id}>`).join('\n') || '*Nobody*';
                const noUsers  = [...noVotes].map(id => `<@${id}>`).join('\n') || '*Nobody*';

                return buttonInteraction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('📊 Current Votes')
                            .setColor(0x95a5a6)
                            .addFields(
                                { name: `✅ Yes (${yesVotes.size})`, value: yesUsers },
                                { name: `❌ No (${noVotes.size})`, value: noUsers }
                            )
                    ],
                    ephemeral: true
                });
            }

            // Must be in the same voice channel to vote
            if (!buttonInteraction.member.voice?.channel || buttonInteraction.member.voice.channel.id !== channel.id) {
                return buttonInteraction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setDescription('❌ You must be in the voice channel to vote.')
                    ],
                    ephemeral: true
                });
            }

            if (buttonInteraction.customId !== 'vote_yes' && buttonInteraction.customId !== 'vote_no') return;

            // Allow vote-swapping (same pattern as votekick/votemute)
            const userId = buttonInteraction.user.id;
            yesVotes.delete(userId);
            noVotes.delete(userId);

            if (buttonInteraction.customId === 'vote_yes') {
                yesVotes.add(userId);
            } else {
                noVotes.add(userId);
            }

            // Recalculate with current VC members
            const currentListeners = getListenerCount();
            const currentRequired = Math.ceil(currentListeners * requiredPercentage);

            const updatedEmbed = new EmbedBuilder()
                .setTitle('🗳️ Vote Stop')
                .setColor(0xf1c40f)
                .setDescription(
                    [
                        `Started by: ${interaction.user}`,
                        '',
                        '> A stop vote has been started.',
                        `> If **50%** of listeners vote **Yes**, the music will be **stopped** and the queue **cleared**.`,
                        '',
                        `*Required Votes:* ***${currentRequired}***`,
                        `*Listeners:* **${currentListeners}**`,
                        `**Voting ends** ${voteDurationString}`
                    ].join('\n')
                )
                .addFields(
                    { name: 'Yes', value: `${yesVotes.size}`, inline: true },
                    { name: 'No', value: `${noVotes.size}`, inline: true }
                )
                .setTimestamp();

            await buttonInteraction.update({
                embeds: [updatedEmbed],
                components: [row]
            });

            // Early pass if threshold met
            if (yesVotes.size >= currentRequired) {
                collector.stop('threshold');
            }
        });

        collector.on('end', async () => {
            const finalListeners = getListenerCount();
            const finalRequired = Math.ceil(finalListeners * requiredPercentage);
            const passed = yesVotes.size >= finalRequired;

            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(row.components[0]).setDisabled(true),
                ButtonBuilder.from(row.components[1]).setDisabled(true),
                ButtonBuilder.from(row.components[2]).setDisabled(true)
            );

            if (passed) {
                // Destroy the queue (stops playback + disconnects)
                const currentQueue = useQueue(interaction.guild.id);
                if (currentQueue) {
                    currentQueue.delete();
                }

                const resultEmbed = new EmbedBuilder()
                    .setTitle('✅ Vote Passed')
                    .setColor(0x2ecc71)
                    .setDescription(
                        `Music has been stopped and the queue cleared.\n` +
                        `> Yes: **${yesVotes.size}**\n` +
                        `> No: **${noVotes.size}**\n` +
                        `> Required Votes: **${finalRequired}**`
                    );

                await message.edit({
                    embeds: [resultEmbed],
                    components: [disabledRow]
                });
            } else {
                const failEmbed = new EmbedBuilder()
                    .setTitle('❌ Vote Failed')
                    .setColor(0xe74c3c)
                    .setDescription(
                        `The music will keep playing.\n` +
                        `> Yes: **${yesVotes.size}**\n` +
                        `> No: **${noVotes.size}**\n` +
                        `> Required Votes: **${finalRequired}**`
                    );

                await message.edit({
                    embeds: [failEmbed],
                    components: [disabledRow]
                });
            }
        });
    }
};
