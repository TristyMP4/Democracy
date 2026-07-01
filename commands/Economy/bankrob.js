const { SlashCommandBuilder } = require('discord.js');
const User = require('../../schemas/User.js');
const Cooldown = require('../../schemas/cooldown.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const VoteManager = require('../../utils/VoteManager.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');

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
        const targetProfile = await User.findOne({ userId: target.id });
        if (!targetProfile || targetProfile.bank < config.minTargetBank) {
            return interaction.reply(ComponentUtils.createError(`The target must have at least ${EconomyConfig.currencySymbol}**${config.minTargetBank.toLocaleString()}** in their bank to be robbed.`));
        }

        await interaction.guild.members.fetch();
        const onlineCount = interaction.guild.members.cache.filter(m => {
            if (m.user.bot) return false;
            const status = m.presence?.status ?? 'offline';
            return status !== 'offline';
        }).size;
        
        if (onlineCount < 3) {
            return interaction.reply(ComponentUtils.createError('There must be at least 3 users online to organize a bank heist.'));
        }

        const commandName = 'bankrob';
        const existingCooldown = await Cooldown.findOne({ userId: interaction.user.id, commandName });

        if (existingCooldown && existingCooldown.expiresAt > new Date()) {
            return interaction.reply(ComponentUtils.createError(`You cannot organize another heist until <t:${Math.floor(existingCooldown.expiresAt.getTime() / 1000)}:f>.`));
        }

        await Cooldown.findOneAndUpdate(
            { userId: interaction.user.id, commandName },
            {
                userId: interaction.user.id,
                commandName,
                expiresAt: new Date(Date.now() + config.cooldown)
            },
            { upsert: true }
        );

        const customValidate = async (buttonInteraction) => {
            const participantProfile = await User.findOne({ userId: buttonInteraction.user.id });
            const totalWealth = (participantProfile?.wallet || 0) + (participantProfile?.bank || 0);
            if (totalWealth < config.minBalanceToJoin) {
                return `You must have at least ${EconomyConfig.currencySymbol}**${config.minBalanceToJoin.toLocaleString()}** to join the crew.`;
            }
            return null;
        };

        const voteResult = await VoteManager.startVote(interaction, {
            title: '🏦 **Bank Heist**',
            description: `A heist is being organized against ${target}'s bank account!\n\n> You need ${EconomyConfig.currencySymbol}**${config.minBalanceToJoin.toLocaleString()}** to join the crew.\n> If the heist fails, you will lose **${config.finePercentage * 100}%** of your money!`,
            fixedRequiredVotes: 1,
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

        const initiatorProfile = await User.findOne({ userId: interaction.user.id });
        const luckMultiplier = initiatorProfile?.luckMultiplier || 1;

        const successRoll = Math.random();
        const chance = config.successChance * luckMultiplier;
        const isSuccess = successRoll <= chance;

        if (isSuccess) {
            const currentTargetProfile = await User.findOne({ userId: target.id });
            const targetBank = currentTargetProfile?.bank || 0;
            
            const randomStealPct = Math.random() * (config.maxStealPercentage - config.minStealPercentage) + config.minStealPercentage;
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

            await User.findOneAndUpdate(
                { userId: target.id },
                { $inc: { bank: -stolenAmount } }
            );

            for (const participantId of yesVotes) {
                await User.findOneAndUpdate(
                    { userId: participantId },
                    { $inc: { wallet: splitAmount } },
                    { upsert: true }
                );
            }

            try {
                await target.send(ComponentUtils.createError(`🚨 **YOUR BANK WAS ROBBED!** 🚨\n\nA crew broke into your vault and stole ${EconomyConfig.currencySymbol}**${stolenAmount.toLocaleString()}**!`));
            } catch (err) {}

            await VoteManager.displayResult(message, {
                passed: true,
                title: 'Heist Successful',
                description: `The crew successfully broke into ${target}'s vault!\n\n> Stolen: ${EconomyConfig.currencySymbol}**${stolenAmount.toLocaleString()}**\n> Split: ${EconomyConfig.currencySymbol}**${splitAmount.toLocaleString()}** per member!`,
                yesVotes, noVotes: new Set(), requiredVotes: 1
            });

        } else {
            let totalLost = 0;
            for (const participantId of yesVotes) {
                const pProfile = await User.findOne({ userId: participantId });
                if (!pProfile) continue;
                
                let loss = 0;
                if (pProfile.bank > 0) {
                    loss = Math.floor(pProfile.bank * config.finePercentage);
                    await User.findOneAndUpdate({ userId: participantId }, { $inc: { bank: -loss } });
                } else {
                    loss = Math.floor((pProfile.wallet || 0) * config.finePercentage);
                    await User.findOneAndUpdate({ userId: participantId }, { $inc: { wallet: -loss } });
                }
                totalLost += loss;
            }

            await VoteManager.displayResult(message, {
                passed: false,
                title: 'Heist Failed',
                description: `The crew was caught!\n\n> Everyone lost **${config.finePercentage * 100}%** of their balance.\n> Total Fines Paid: ${EconomyConfig.currencySymbol}**${totalLost.toLocaleString()}**`,
                yesVotes, noVotes: new Set(), requiredVotes: 1
            });
        }
    }
};
