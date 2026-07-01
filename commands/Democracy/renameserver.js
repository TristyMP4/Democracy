const { SlashCommandBuilder } = require('discord.js');
const Cooldown = require('../../schemas/cooldown.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const VoteManager = require('../../utils/VoteManager.js');
const cooldownMinutes = 10;

module.exports = {
    democracy: true,
    data: new SlashCommandBuilder()
        .setName('renameserver')
        .setDescription('Start a vote to rename the server.')
        .addStringOption(option =>
            option
                .setName('name')
                .setDescription('Name to vote for')
                .setRequired(true)
        ),

    async execute(interaction) {
        const newName = interaction.options.getString('name');

        const commandName = 'renameserver';
        const existingCooldown = await Cooldown.findOne({
            userId: interaction.user.id,
            commandName
        });

        if (existingCooldown && existingCooldown.expiresAt > new Date()) {
            const secondsLeft = Math.ceil((existingCooldown.expiresAt.getTime() - Date.now()) / 1000);
            return interaction.reply(ComponentUtils.createError(`You must wait **${secondsLeft} seconds** before voting to change server name again.`));
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
            `Started by: ${interaction.user}`,
            '> A rename server vote has been started.',
            `> If **60%** of online members vote **Yes**, the server will be renamed.`,
            `**New Server Name:** \`${newName}\``
        ];

        const voteResult = await VoteManager.startVote(interaction, {
            title: '🗳️ **Vote Server Rename**',
            description: descriptionLines.join('\n'),
            requiredPercentage: 0.60,
            duration: 60_000,
            requireOnline: true
        });

        if (!voteResult) return; // Early exit (e.g. not enough users)

        const { passed, yesVotes, noVotes, requiredVotes, message } = voteResult;

        if (passed) {
            try {
                await interaction.guild.setName(newName);
                
                await VoteManager.displayResult(message, {
                    passed: true,
                    title: 'Vote Passed',
                    description: `The server has been renamed to \`${newName}\``,
                    yesVotes, noVotes, requiredVotes
                });
            } catch (err) {
                await VoteManager.displayResult(message, {
                    passed: false,
                    title: 'Server Rename Failed',
                    description: `The vote passed, but I couldn't rename the server.\n\`\`\`${err.message}\`\`\``,
                    yesVotes, noVotes, requiredVotes
                });
            }
        } else {
            await VoteManager.displayResult(message, {
                passed: false,
                title: 'Vote Failed',
                description: `The server will not be renamed.`,
                yesVotes, noVotes, requiredVotes
            });
        }
    }
};