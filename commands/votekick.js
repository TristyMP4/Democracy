const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const Stat = require('../schemas/stats');
const Cooldown = require('../schemas/cooldown');
const cooldownMinutes = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('votekick')
        .setDescription('Start a vote to kick a user.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to vote kick')
                .setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user');

        const commandName = 'votekick';
        const existingCooldown = await Cooldown.findOne({
            userId: interaction.user.id,
            commandName
        });

        if (existingCooldown && existingCooldown.expiresAt > new Date()) {
            const secondsLeft = Math.ceil(
                (existingCooldown.expiresAt.getTime() - Date.now()) / 1000
            );

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription(
                            `❌ You must wait **${secondsLeft} seconds** before voting to kick someone again.`
                        )
                ],
                ephemeral: true
            });
        }

        if (target.bot) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription('❌ You cannot vote for bots.')
                ],
                ephemeral: true
            });
        }

        if (duration < 1 || duration > 15) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription('❌ Mute duration must be between **1** and **5** minutes.')
                ],
                ephemeral: true
            });
        }

        const targetMember = await interaction.guild.members.fetch(target.id);
        if (!targetMember.moderatable) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription('❌ I cannot kick that user.')
                ],
                ephemeral: true
            });
        }

        await interaction.guild.members.fetch();
        const onlineMembers = interaction.guild.members.cache.filter(member => {
            if (member.user.bot) return false;

            const status = member.presence?.status ?? 'offline';
            return status !== 'offline';
        });

        const onlineCount = onlineMembers.size;
        if (onlineCount < 2) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription('❌ Not enough online users to start a vote.')
                ],
                ephemeral: true
            });
        }
        
        await Stat.findOneAndUpdate(
            { userId: interaction.user.id },
            {
                $inc: { 'votekicks.initiated': 1 }
            },
            { upsert: true }
        );

        await Cooldown.findOneAndUpdate(
            {
                userId: interaction.user.id,
                commandName
            },
            {
                userId: interaction.user.id,
                commandName,
                expiresAt: new Date(
                    Date.now() + cooldownMinutes * 60 * 1000
                )
            },
            {
                upsert: true,
                new: true
            }
        );

        const yesVotes = new Set();
        const noVotes = new Set();

        const voteDuration = 60_000; // 60 seconds
        const requiredVotes = Math.ceil(onlineCount * 0.75);
        // const requiredVotes = 1

        const embed = new EmbedBuilder()
            .setTitle('🗳️ Vote Kick')
            .setColor(0xf1c40f)
            .setDescription(
                [
                    `Target: ${target}`,
                    `Started by: ${interaction.user}`,
                    '> A kick vote has been started.',
                    `> If **75%** of online members vote **Yes**, the user will be kicked out of the server.`,
                    '',
                    `*Required Votes to win:* ***${requiredVotes}***`,
                    `*Online Members:* **${onlineCount}**`,
                    `**Voting ends** <t:${Math.floor((Date.now() + voteDuration) / 1000)}:R>`
                ].join('\n')
            )
            .addFields(
                {
                    name: 'Yes',
                    value: '0',
                    inline: true
                },
                {
                    name: 'No',
                    value: '0',
                    inline: true
                }
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('vote_yes')
                .setLabel('Yes')
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId('vote_no')
                .setLabel('No')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({
            content: '@here',
            embeds: [embed],
            components: [row],
            allowedMentions: {
                parse: ['everyone']
            }
        });

        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            time: voteDuration
        });

        collector.on('collect', async buttonInteraction => {
            if (
                buttonInteraction.customId !== 'vote_yes' &&
                buttonInteraction.customId !== 'vote_no'
            ) {
                return;
            }

            const userId = buttonInteraction.user.id;

            yesVotes.delete(userId);
            noVotes.delete(userId);

            if (buttonInteraction.customId === 'vote_yes') {
                yesVotes.add(userId);
            } else {
                noVotes.add(userId);
            }

            const updatedEmbed = EmbedBuilder.from(embed).setFields(
                {
                    name: 'Yes',
                    value: `${yesVotes.size}`,
                    inline: true
                },
                {
                    name: 'No',
                    value: `${noVotes.size}`,
                    inline: true
                }
            );

            await buttonInteraction.update({
                embeds: [updatedEmbed],
                components: [row]
            });
        });

        collector.on('end', async () => {
            const passed = yesVotes.size >= requiredVotes;

            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(row.components[0]).setDisabled(true),
                ButtonBuilder.from(row.components[1]).setDisabled(true)
            );

            if (passed) {
                try {
                    await Stat.findOneAndUpdate(
                        { userId: interaction.user.id },
                        {
                            $inc: { 'votekicks.passed': 1 }
                        },
                        { upsert: true }
                    );

                    await Stat.findOneAndUpdate(
                        { userId: target.id },
                        {
                            $inc: { 'votekicks.received': 1 }
                        },
                        { upsert: true }
                    );

                    await targetMember.kick(`Vote mute passed (${yesVotes.size}/${onlineCount} online users voted yes)`);
                    const resultEmbed = new EmbedBuilder()
                        .setTitle('✅ Vote Passed')
                        .setColor(0x2ecc71)
                        .setDescription(
                            `${target} has been kicked from the server.\n` +
                            `> Yes: **${yesVotes.size}**\n` +
                            `> No: **${noVotes.size}**\n` +
                            `> Required Votes to win: **${requiredVotes}**`
                        );

                    try {
                        await target.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0xf1c40f)
                                    .setTitle('👟 You have been kicked.')
                                    .setDescription(
                                        `You were kicked in **${interaction.guild.name}** via a community vote.\n\n` +
                                        `> 📋 Initial Voter: **${interaction.user.tag}**`
                                    )
                                    .setTimestamp()
                            ]
                        });
                    } catch (err) {
                        // user has DMs closed or blocked bot
                    }

                    await message.edit({
                        embeds: [resultEmbed],
                        components: [disabledRow]
                    });
                } catch (err) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Kick Failed')
                        .setColor(0xe74c3c)
                        .setDescription(
                            `The vote passed, but I couldn't kick the user.\n\`\`\`${err.message}\`\`\``
                        );

                    await message.edit({
                        embeds: [errorEmbed],
                        components: [disabledRow]
                    });
                }
            } else {
                await Stat.findOneAndUpdate(
                    { userId: interaction.user.id },
                    {
                        $inc: { 'votekicks.failed': 1 }
                    },
                    { upsert: true }
                );

                const failEmbed = new EmbedBuilder()
                    .setTitle('❌ Vote Failed')
                    .setColor(0xe74c3c)
                    .setDescription(
                        `${target} will not be kicked.\n` +
                        `> Yes: **${yesVotes.size}**\n` +
                        `> No: **${noVotes.size}**\n` +
                        `> Required Votes to win: **${requiredVotes}**`
                    );

                await message.edit({
                    embeds: [failEmbed],
                    components: [disabledRow]
                });
            }
        });
    }
};