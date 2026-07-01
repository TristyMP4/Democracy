const { SlashCommandBuilder } = require('discord.js');
const Stat = require('../../schemas/stats.js');
const Cooldown = require('../../schemas/cooldown.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const VoteManager = require('../../utils/VoteManager.js');
const cooldownMinutes = 10;

module.exports = {
    democracy: true,
    data: new SlashCommandBuilder()
        .setName('votemute')
        .setDescription('Start a vote to mute a user in the server.')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The user you want to mute')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('duration')
                .setDescription('Duration of the mute in minutes (1-60, default 10)')
                .setMinValue(1)
                .setMaxValue(60)
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('Reason for the mute')
                .setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const duration = interaction.options.getInteger('duration') || 10;
        const reason = interaction.options.getString('reason');

        if (target.bot) {
            return interaction.reply(ComponentUtils.createError('You cannot start a vote against a bot.'));
        }
        if (target.id === interaction.user.id) {
            return interaction.reply(ComponentUtils.createError('You cannot start a vote against yourself.'));
        }

        const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) {
            return interaction.reply(ComponentUtils.createError('User is not in this server.'));
        }

        const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
        if (
            targetMember.id === interaction.guild.ownerId ||
            targetMember.roles.highest.position >= botMember.roles.highest.position ||
            targetMember.permissions.has('Administrator')
        ) {
            return interaction.reply(ComponentUtils.createError('I cannot mute this user because they have higher or equal permissions than me, or they are an Administrator.'));
        }

        if (targetMember.communicationDisabledUntilTimestamp > Date.now()) {
            return interaction.reply(ComponentUtils.createError('This user is already muted!'));
        }

        const commandName = 'votemute';
        const existingCooldown = await Cooldown.findOne({
            userId: interaction.user.id,
            commandName
        });

        if (existingCooldown && existingCooldown.expiresAt > new Date()) {
            const secondsLeft = Math.ceil((existingCooldown.expiresAt.getTime() - Date.now()) / 1000);
            return interaction.reply(ComponentUtils.createError(`You must wait **${secondsLeft} seconds** before starting another mute vote.`));
        }

        await Cooldown.findOneAndUpdate(
            { userId: interaction.user.id, commandName },
            {
                userId: interaction.user.id,
                commandName,
                expiresAt: new Date(Date.now() + cooldownMinutes * 60 * 1000)
            },
            { upsert: true }
        );

        const descriptionLines = [
            `Target: ${target}`,
            `Started by: ${interaction.user}`
        ];

        if (reason?.trim()) {
            descriptionLines.push(`**Reason:** \`${reason}\``);
        }
        descriptionLines.push(
            '> A mute vote has been started.',
            `> If **60%** of online members vote **Yes**, the user will be muted for **${duration} minute${duration === 1 ? '' : 's'}**.`
        );

        const voteResult = await VoteManager.startVote(interaction, {
            title: '🗳️ **Vote Mute**',
            description: descriptionLines.join(''),
            requiredPercentage: 0.60,
            duration: 60_000,
            requireOnline: true,
            targetId: target.id
        });

        if (!voteResult) return;

        const { passed, yesVotes, noVotes, requiredVotes, message, onlineCount } = voteResult;

        if (passed) {
            try {
                await Stat.findOneAndUpdate(
                    { userId: interaction.user.id },
                    { $inc: { 'votemutes.passed': 1 } },
                    { upsert: true }
                );

                try {
                    await target.send(ComponentUtils.createError(`You were muted in **${interaction.guild.name}** for **${duration} minute${duration === 1 ? '' : 's'}** via a community vote.\n\n> 📋 Initial Voter: **${interaction.user.tag}**`));
                } catch (err) {}

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

                await targetMember.timeout(duration * 60 * 1000, `Vote mute passed (${yesVotes.size}/${onlineCount} online users voted yes)`);

                const resultDescLines = [`${target} has been **muted for ${duration} minute${duration === 1 ? '' : 's'}.**`];
                if (reason?.trim()) resultDescLines.push(`**Reason:** \`${reason}\``);

                await VoteManager.displayResult(message, {
                    passed: true,
                    title: 'Vote Passed',
                    description: resultDescLines.join('\n'),
                    yesVotes, noVotes, requiredVotes
                });
            } catch (err) {
                await VoteManager.displayResult(message, {
                    passed: false,
                    title: 'Mute Failed',
                    description: `The vote passed, but I couldn't mute the user.\n\`\`\`${err.message}\`\`\``,
                    yesVotes, noVotes, requiredVotes
                });
            }
        } else {
            await Stat.findOneAndUpdate(
                { userId: interaction.user.id },
                { $inc: { 'votemutes.failed': 1 } },
                { upsert: true }
            );

            await VoteManager.displayResult(message, {
                passed: false,
                title: 'Vote Failed',
                description: `${target} will not be muted.`,
                yesVotes, noVotes, requiredVotes
            });
        }
    }
};