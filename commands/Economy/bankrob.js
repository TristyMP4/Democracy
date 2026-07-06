const { SlashCommandBuilder } = require('discord.js');
const Cooldown = require('../../schemas/cooldown.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const VoteManager = require('../../utils/VoteManager.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bankrob')
        .setDescription('Organize a heist against a user\'s bank account.')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The user you want to rob')
                .setRequired(true)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        
        if (target.bot) {
            return interaction.reply(ComponentUtils.createError('You cannot rob a bot.'));
        }
        if (target.id === interaction.user.id) {
            return interaction.reply(ComponentUtils.createError('You cannot rob yourself.'));
        }

        const config = EconomyConfig.bankrob;
        const targetProfile = await EconomyUtils.getUser(target.id);
        if (targetProfile.bank < config.minTargetBank) {
            return interaction.reply(ComponentUtils.createError(`The target must have at least ${EconomyConfig.currencySymbol}**${config.minTargetBank.toLocaleString()}** in their bank to be robbed.`));
        }

        // Use presences cache to count online users instead of fetching all members (prevents Opcode 8 rate limits)
        const onlineCount = interaction.guild.presences.cache.filter(p => {
            return p.status !== 'offline' && p.user && !p.user.bot;
        }).size;
        
        if (onlineCount < 3) {
            return interaction.reply(ComponentUtils.createError('There must be at least 3 users online to organize a bank heist.'));
        }

        const commandName = 'bankrob';
        const existingCooldown = await Cooldown.findOne({ userId: interaction.user.id, commandName });

        if (existingCooldown && existingCooldown.expiresAt > new Date()) {
            return interaction.reply(ComponentUtils.createError(`You cannot organize another heist until <t:${Math.floor(existingCooldown.expiresAt.getTime() / 1000)}:f>.`));
        }

        const settings = await EconomyUtils.getSettings();
        const userData = await EconomyUtils.getUser(interaction.user.id);
        const globalMultiplier = settings.cooldownMultiplier || 1.0;
        const userMultiplier = userData.cooldownMultiplier || 1.0;
        const cooldownTime = config.cooldown * globalMultiplier * userMultiplier;

        await Cooldown.findOneAndUpdate(
            { userId: interaction.user.id, commandName },
            {
                userId: interaction.user.id,
                commandName,
                expiresAt: new Date(Date.now() + cooldownTime)
            },
            { upsert: true }
        );

        const customValidate = async (buttonInteraction) => {
            const participantProfile = await EconomyUtils.getUser(buttonInteraction.user.id);
            const totalWealth = participantProfile.wallet + participantProfile.bank;
            if (totalWealth < config.minBalanceToJoin) {
                return `You must have at least ${EconomyConfig.currencySymbol}**${config.minBalanceToJoin.toLocaleString()}** to join the crew.`;
            }
            return null;
        };

        const voteResult = await VoteManager.startVote(interaction, {
            title: '🏦 **Bank Heist**',
            description: `A heist is being organized against ${target}'s bank account!\n> You need ${EconomyConfig.currencySymbol}**${config.minBalanceToJoin.toLocaleString()}** to join the crew.\n> If the heist fails, you will lose **${config.finePercentage * 100}%** of your money!`,
            fixedRequiredVotes: 2,
            duration: 150_000,
            requireOnline: true,
            targetId: target.id,
            pingType: 'everyone',
            yesLabel: 'Join Heist',
            noLabel: 'Opt Out',
            yesEmoji: '🔫',
            noEmoji: '🚪',
            customValidate
        });

        if (!voteResult) return;

        const { passed, yesVotes, message } = voteResult;

        if (!passed || yesVotes.size === 0) {
            return VoteManager.displayResult(message, {
                passed: false,
                title: 'Heist Cancelled',
                description: `Nobody joined the crew. The heist against ${target} was cancelled.`,
                yesVotes, noVotes: new Set(), requiredVotes: 1
            });
        }

        const extraPeople = Math.max(0, yesVotes.size - 2);
        const bonusChance = extraPeople * 0.05; // +5% per extra person beyond the first 2
        const baseChance = Math.min(0.80, config.successChance + bonusChance);

        const rollResult = await EconomyUtils.calculateLuckRoll(baseChance, interaction.user.id);

        if (rollResult.isSuccess) {
            const currentTargetProfile = await EconomyUtils.getUser(target.id);
            const targetBank = currentTargetProfile.bank;
            
            const bonusSteal = extraPeople * 0.0625; // +6.25% steal per extra person
            const calculatedMinSteal = Math.min(0.80, config.minStealPercentage + bonusSteal);
            const calculatedMaxSteal = Math.min(1.0, config.maxStealPercentage + bonusSteal);

            const randomStealPct = Math.random() * (calculatedMaxSteal - calculatedMinSteal) + calculatedMinSteal;
            let stolenAmount = Math.floor(targetBank * randomStealPct);
            
            if (stolenAmount <= 0) {
                 return VoteManager.displayResult(message, {
                    passed: false,
                    title: 'Heist Failed',
                    description: `The crew broke in, but ${target}'s vault was completely empty!`,
                    yesVotes, noVotes: new Set(), requiredVotes: 1
                });
            }

            const splitAmount = Math.floor(stolenAmount / yesVotes.size);

            await EconomyUtils.removeCash(target.id, stolenAmount, 'bank');

            for (const participantId of yesVotes) {
                await EconomyUtils.addCash(participantId, splitAmount, 'wallet');
            }

            const participantsMentions = [...yesVotes].map(id => `- <@${id}>`).join('\n');

            try {
                await target.send(ComponentUtils.createError(`🚨 **YOUR BANK WAS ROBBED!** 🚨\nA crew broke into your bank account and stole ${EconomyConfig.currencySymbol}**${stolenAmount.toLocaleString()}**!\n\n**The Crew:**\n${participantsMentions}\n\n[View Heist Message](${message.url})`));
            } catch (err) {}

            await VoteManager.displayResult(message, {
                passed: true,
                title: 'Heist Successful',
                description: `The crew successfully broke into ${target}'s vault!\n\n> Stolen: ${EconomyConfig.currencySymbol}**${stolenAmount.toLocaleString()}**\n> Split: ${EconomyConfig.currencySymbol}**${splitAmount.toLocaleString()}** per member!`,
                yesVotes, noVotes: new Set(), requiredVotes: 1
            });

            // Broadcast News Event
            await EconomyUtils.postNewsEvent(
                interaction.guild,
                `# 💰 HEIST SUCCESSFUL\nA crew just broke into ${target}'s vault and stole ${EconomyConfig.currencySymbol}**${stolenAmount.toLocaleString()}**!`,
                EconomyConfig.successColor
            );

        } else {
            let totalLost = 0;
            for (const participantId of yesVotes) {
                const pProfile = await EconomyUtils.getUser(participantId);
                const fine = Math.floor((pProfile.wallet + pProfile.bank) * config.finePercentage);
                const { actualRemoved } = await EconomyUtils.removeCash(participantId, fine, 'cascade');
                totalLost += actualRemoved;
            }

            if (totalLost > 0) {
                await EconomyUtils.addCash(target.id, totalLost, 'bank');
            }

            const participantsMentions = [...yesVotes].map(id => `- <@${id}>`).join('\n');
            try {
                await target.send(ComponentUtils.createSuccess(`🛡️ **BANK HEIST THWARTED!** 🛡️\nA crew tried to rob your bank, but security stopped them! You were awarded ${EconomyConfig.currencySymbol}**${totalLost.toLocaleString()}** from their fines as restitution.\n\n**The Failed Crew:**\n${participantsMentions}\n\n[View Heist Message](${message.url})`));
            } catch (err) {}

            await VoteManager.displayResult(message, {
                passed: false,
                title: 'Heist Failed',
                description: `The crew was caught!\n> Everyone lost **${config.finePercentage * 100}%** of their balance.\n> Restitution Paid to ${target}: ${EconomyConfig.currencySymbol}**${totalLost.toLocaleString()}**`,
                yesVotes, noVotes: new Set(), requiredVotes: 1
            });
        }
    }
};
