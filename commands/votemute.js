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
        .setName('votemute')
        .setDescription('Start a vote to mute a user.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to vote mute')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('duration')
                .setDescription('Mute duration in minutes (1-5)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(15)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the vote')
                .setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const duration = interaction.options.getInteger('duration');
        const reason = interaction.options.getString('reason');

        const commandName = 'votemute';
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
                            `❌ You must wait **${secondsLeft} seconds** before voting to mute someone again.`
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
                        .setDescription('❌ Mute duration must be between **1** and **15** minutes.')
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
                        .setDescription('❌ I cannot mute that user.')
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
        const getCurrentOnlineCount = () => {
            return interaction.guild.members.cache.filter(member => {
                if (member.user.bot) return false;

                const status = member.presence?.status ?? 'offline';
                return status !== 'offline';
            }).size;
        };

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
                $inc: { 'votemutes.initiated': 1 }
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
        const voteDurationString = `<t:${Math.floor((Date.now() + voteDuration) / 1000)}:R>`
        const requiredPercentage = 0.6 // 60%
        const requiredVotes = Math.ceil(onlineCount * requiredPercentage);
        // const requiredVotes = 1

        const descriptionLines = [
            `Target: ${target}`,
            `Started by: ${interaction.user}`
        ];

        if (reason?.trim()) {
            descriptionLines.push(`**Reason:** \`${reason}\``);
        }

        descriptionLines.push(
            '> A mute vote has been started.',
            `> If **60%** of online members vote **Yes**, the user will be muted for **${duration} minute${duration === 1 ? '' : 's'}**.`,
            '',
            `*Required Votes to win:* ***${requiredVotes}***`,
            `*Online Members:* **${onlineCount}**`,
            `**Voting ends** ${voteDurationString}`
        );

        const embed = new EmbedBuilder()
            .setTitle('🗳️ Vote Mute')
            .setColor(0xf1c40f)
            .setDescription(descriptionLines.join('\n'))
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
            if (buttonInteraction.customId === 'vote_list') {

                const yesUsers = [...yesVotes]
                    .map(id => `<@${id}>`)
                    .join('\n') || '*Nobody*';

                const noUsers = [...noVotes]
                    .map(id => `<@${id}>`)
                    .join('\n') || '*Nobody*';

                const votesEmbed = new EmbedBuilder()
                    .setTitle('📊 Current Votes')
                    .setColor(0x95a5a6)
                    .addFields(
                        {
                            name: `✅ Yes (${yesVotes.size})`,
                            value: yesUsers
                        },
                        {
                            name: `❌ No (${noVotes.size})`,
                            value: noUsers
                        }
                    );

                return buttonInteraction.reply({
                    embeds: [votesEmbed],
                    ephemeral: true
                });
            }

            const member = await interaction.guild.members.fetch(
                buttonInteraction.user.id
            );

            const status = member.presence?.status ?? 'offline';

            if (status === 'offline') {
                return buttonInteraction.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setDescription('❌ You cannot vote while appearing offline.')
                    ],
                    ephemeral: true
                });
            }

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

            const currentOnlineCount = getCurrentOnlineCount();
            const currentRequiredVotes = Math.ceil(currentOnlineCount * requiredPercentage);

            const descriptionLines = [
                `Target: ${target}`,
                `Started by: ${interaction.user}`
            ];

            if (reason?.trim()) {
                descriptionLines.push(`**Reason:** \`${reason}\``);
            }

            descriptionLines.push(
                '> A mute vote has been started.',
                `> If **60%** of online members vote **Yes**, the user will be muted for **${duration} minute${duration === 1 ? '' : 's'}**.`,
                '',
                `*Required Votes to win:* ***${currentRequiredVotes}***`,
                `*Online Members:* **${currentOnlineCount}**`,
                `**Voting ends** ${voteDurationString}`
            );

            const updatedEmbed = new EmbedBuilder()
                .setTitle('🗳️ Vote Mute')
                .setColor(0xf1c40f)
                .setDescription(descriptionLines.join('\n'))
                .addFields(
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
                )
                .setTimestamp();
            await buttonInteraction.update({
                embeds: [updatedEmbed],
                components: [row]
            });
        });

        collector.on('end', async () => {
            const finalOnlineCount = getCurrentOnlineCount();
            const finalRequiredVotes = Math.ceil(finalOnlineCount * requiredPercentage);

            const passed = yesVotes.size >= finalRequiredVotes;

            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(row.components[0]).setDisabled(true),
                ButtonBuilder.from(row.components[1]).setDisabled(true),
                ButtonBuilder.from(row.components[2]).setDisabled(true)
            );

            if (passed) {
                try {
                    await Stat.findOneAndUpdate(
                        { userId: interaction.user.id },
                        {
                            $inc: { 'votemutes.passed': 1 }
                        },
                        { upsert: true }
                    );

                    await Stat.findOneAndUpdate(
                        { userId: target.id },
                        {
                            $inc: { 'votemutes.received': 1 }
                        },
                        { upsert: true }
                    );

                    await Stat.findOneAndUpdate(
                        { userId: target.id },
                        {
                            $inc: { 'votemutes.received': 1 },

                            $push: {
                                'votemutes.history': {
                                    reason: reason || 'No reason provided',
                                    duration,
                                    initiatedBy: interaction.user.id,
                                    date: new Date()
                                }
                            }
                        },
                        { upsert: true }
                    );

                    await targetMember.timeout(
                        duration * 60 * 1000,
                        `Vote mute passed (${yesVotes.size}/${finalOnlineCount} online users voted yes)`
                    );

                    const resultEmbed = new EmbedBuilder()
                        .setTitle('✅ Vote Passed')
                        .setColor(0x2ecc71)
                        .setDescription(
                            `${target} has been muted for **${duration} minute${duration === 1 ? '' : 's'}**.\n` +
                            `> Yes: **${yesVotes.size}**\n` +
                            `> No: **${noVotes.size}**\n` +
                            `> Required Votes to win: **${finalRequiredVotes}**`
                        );

                    try {
                        await target.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0xf1c40f)
                                    .setTitle('🔇 You have been muted.')
                                    .setDescription(
                                        `You were muted in **${interaction.guild.name}** via a community vote.\n\n` +
                                        `> ⏱ Duration: **${duration} minute${duration === 1 ? '' : 's'}**\n` +
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
                        .setTitle('❌ Mute Failed')
                        .setColor(0xe74c3c)
                        .setDescription(
                            `The vote passed, but I couldn't mute the user.\n\`\`\`${err.message}\`\`\``
                        )
                        .setTimestamp();
                    await message.edit({
                        embeds: [errorEmbed],
                        components: [disabledRow]
                    });
                }
            } else {
                await Stat.findOneAndUpdate(
                    { userId: interaction.user.id },
                    {
                        $inc: { 'votemutes.failed': 1 }
                    },
                    { upsert: true }
                );

                const failEmbed = new EmbedBuilder()
                    .setTitle('❌ Vote Failed')
                    .setColor(0xe74c3c)
                    .setDescription(
                        `${target} will not be muted.\n` +
                        `> Yes: **${yesVotes.size}**\n` +
                        `> No: **${noVotes.size}**\n` +
                        `> Required Votes to win: **${finalRequiredVotes}**`
                    )
                    .setTimestamp();
                await message.edit({
                    embeds: [failEmbed],
                    components: [disabledRow]
                });
            }
        });
    }
};