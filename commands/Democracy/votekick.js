const {
    SlashCommandBuilder,
    ContainerBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const Stat = require('../../schemas/stats');
const Cooldown = require('../../schemas/cooldown');
const cooldownMinutes = 10;
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    democracy: true,
    data: new SlashCommandBuilder()
        .setName('votekick')
        .setDescription('Start a vote to kick a user.')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to vote kick')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the vote')
                .setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('user');
        const reason = interaction.options.getString('reason');

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
            return interaction.reply(ComponentUtils.createError('You cannot vote for bots.'));
        }

        const targetMember = await interaction.guild.members.fetch(target.id);
        if (!targetMember.moderatable) {
            return interaction.reply(ComponentUtils.createError('I cannot kick that user.'));
        }

        await interaction.guild.members.fetch();
        const onlineMembers = interaction.guild.members.cache.filter(member => {
            if (member.user.bot) return false;
            const status = member.presence?.status ?? 'offline';
                
            // ignore target user if they are online
            if (member.id === target.id && status !== 'offline') return false;
            return status !== 'offline';
        });

        const onlineCount = onlineMembers.size;
        const getCurrentOnlineCount = () => {
            return interaction.guild.members.cache.filter(member => {
                if (member.user.bot) return false;
                const status = member.presence?.status ?? 'offline';
                
                // ignore target user if they are online
                if (member.id === target.id && status !== 'offline') return false;
                return status !== 'offline';
            }).size;
        };     

        if (onlineCount < 2) {
            return interaction.reply(ComponentUtils.createError('Not enough online users to start a vote.'));
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

        const voteDuration = 120_000; // 120 seconds
        const voteDurationString = `<t:${Math.floor((Date.now() + voteDuration) / 1000)}:R>`
        const requiredPercentage = 0.75 // 75%
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
            '> A kick vote has been started.',
            `> If **75%** of online members vote **Yes**, the user will be **kicked from the server.**.`,
            '',
            `*Required Votes to win:* ***${requiredVotes}***`,
            `*Online Members:* **${onlineCount}**`,
            `**Voting ends** ${voteDurationString}`
        );

        const titleDisplay = ComponentUtils.createText(`### 🗳️ **Vote Kick**`);
        const descDisplay = ComponentUtils.createText(descriptionLines.join('\n'));
        const yesDisplay = ComponentUtils.createText(`**Yes**\n0`);
        const noDisplay = ComponentUtils.createText(`**No**\n0`);

        const container = new ContainerBuilder()
            .setAccentColor(0xf1c40f)
            .addTextDisplayComponents(titleDisplay)
            .addSeparatorComponents(ComponentUtils.createSeparator())
            .addTextDisplayComponents(descDisplay)
            .addSeparatorComponents(ComponentUtils.createSeparator())
            .addTextDisplayComponents(yesDisplay, noDisplay);

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
            allowedMentions: { parse: ['everyone'] }
        });
        
        const payload = ComponentUtils.createContainerResponse(container);
        payload.components.push(row);
        const message = await interaction.channel.send(payload);

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
            if (buttonInteraction.user.id === target.id) {
                return buttonInteraction.reply(ComponentUtils.createError('You cannot vote on yourself!'));
            }

            const member = await interaction.guild.members.fetch(
                buttonInteraction.user.id
            );
            const status = member.presence?.status ?? 'offline';

            if (status === 'offline') {
                return buttonInteraction.reply(ComponentUtils.createError('You cannot vote while appearing offline.'));
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
                '> A kick vote has been started.',
                `> If **75%** of online members vote **Yes**, the user will be **kicked from the server.**.`,
                '',
                `*Required Votes to win:* ***${currentRequiredVotes}***`,
                `*Online Members:* **${currentOnlineCount}**`,
                `**Voting ends** ${voteDurationString}`
            );

            const updatedEmbed = new EmbedBuilder()
                .setTitle('🗳️ Vote Kick')
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
                            $inc: { 'votekicks.passed': 1 }
                        },
                        { upsert: true }
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

                    await Stat.findOneAndUpdate(
                        { userId: target.id },
                        {
                            $inc: { 'votekicks.received': 1 },

                            $push: {
                                'votekicks.history': {
                                    reason: reason || 'No reason provided',
                                    duration,
                                    initiatedBy: interaction.user.id,
                                    date: new Date()
                                }
                            }
                        },
                        { upsert: true }
                    );

                    await targetMember.kick(`Vote kick passed (${yesVotes.size}/${finalOnlineCount} online users voted yes)`);
                    const descriptionLines = [
                        `${target} has been **kicked from the server.**`,
                    ];

                    if (reason?.trim()) {
                        descriptionLines.push(`**Reason:** \`${reason}\``);
                    }

                    descriptionLines.push(
                        `> Yes: **${yesVotes.size}**`,
                        `> No: **${noVotes.size}**`,
                        `> Required Votes to win: **${finalRequiredVotes}**`,
                    );

                    const resultTitle = ComponentUtils.createText(`### ✅ **Vote Passed**`);
                    const resultDesc = ComponentUtils.createText(descriptionLines.join('\n'));
                    const resultContainer = new ContainerBuilder()
                        .setAccentColor(0x2ecc71)
                        .addTextDisplayComponents(resultTitle)
                        .addSeparatorComponents(ComponentUtils.createSeparator())
                        .addTextDisplayComponents(resultDesc);

                    const resultPayload = ComponentUtils.createContainerResponse(resultContainer);
                    resultPayload.components.push(disabledRow);
                    await message.edit(resultPayload);
                } catch (err) {
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('❌ Kick Failed')
                        .setColor(0xe74c3c)
                        .setDescription(
                            `The vote passed, but I couldn't kick the user.\n\`\`\`${err.message}\`\`\``
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