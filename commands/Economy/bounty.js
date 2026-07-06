const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const parseAmount = require('../../utils/AmountParser.js');
const EconomyUser = require('../../schemas/EconomyUser.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('bounty')
        .setDescription('Manage and view bounties on players.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('place')
                .setDescription('Place a bounty on a player.')
                .addUserOption(option => option.setName('target').setDescription('The user to place a bounty on').setRequired(true))
                .addStringOption(option => option.setName('amount').setDescription('Amount to place (e.g. 1000, 5k, half, max)').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View bounties placed on a player.')
                .addUserOption(option => option.setName('target').setDescription('The user to view').setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List the most wanted players in the server.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('payoff')
                .setDescription('Pay off a bounty for yourself or someone else.')
                .addUserOption(option => option.setName('target').setDescription('The user whose bounty you want to pay off').setRequired(true))
                .addStringOption(option => option.setName('amount').setDescription('Amount to pay off (e.g. 5000, half, max, all)').setRequired(true))
        ),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'place') {
                const target = interaction.options.getUser('target');
                const amountStr = interaction.options.getString('amount');

                if (target.bot) return interaction.followUp(ComponentUtils.createError('You cannot place a bounty on a bot!'));
                if (target.id === interaction.user.id) return interaction.followUp(ComponentUtils.createError('You cannot place a bounty on yourself!'));

                const userData = await EconomyUtils.getUser(interaction.user.id);
                const amount = parseAmount(amountStr, userData.wallet);

                if (amount === 0 && (amountStr.toLowerCase() === 'max' || amountStr.toLowerCase() === 'all')) {
                    return interaction.followUp(ComponentUtils.createError('Your wallet is empty! You have no money to place a bounty.'));
                }

                if (amount <= 0 || isNaN(amount)) {
                    return interaction.followUp(ComponentUtils.createError('Please provide a valid amount to place as a bounty.'));
                }

                const minBounty = EconomyConfig.bounty.minAmount || 1000;
                if (amount < minBounty) {
                    return interaction.followUp(ComponentUtils.createError(`The minimum bounty amount is **${EconomyConfig.currencySymbol}${minBounty.toLocaleString()}**.`));
                }

                if (userData.wallet < amount) {
                    return interaction.followUp(ComponentUtils.createError(`You do not have enough money in your wallet! You need **${EconomyConfig.currencySymbol}${amount.toLocaleString()}**.`));
                }

                // Deduct money and place bounty
                await EconomyUtils.removeCash(interaction.user.id, amount);
                await EconomyUtils.addBounty(target.id, amount, interaction.user.id);

                // Broadcast News Event
                await EconomyUtils.postNewsEvent(
                    interaction.guild,
                    `# 🎯 BOUNTY PLACED\n**${interaction.user}** just placed a **${EconomyConfig.currencySymbol}${amount.toLocaleString()}** bounty on **${target}**'s head!`,
                    EconomyConfig.failColor
                );

                const embed = new EmbedBuilder()
                    .setTitle('🎯 Bounty Placed!')
                    .setDescription(`You successfully placed a bounty of ${EconomyConfig.currencySymbol}**${amount.toLocaleString()}** on <@${target.id}>'s head!`)
                    .setColor(EconomyConfig.failColor); // Red for danger/bounty

                return interaction.followUp({ embeds: [embed] });

            } else if (subcommand === 'view') {
                const target = interaction.options.getUser('target');
                if (target.bot) return interaction.followUp(ComponentUtils.createError('Bots do not have bounties!'));

                const targetData = await EconomyUtils.getUser(target.id);
                const bounties = targetData.bounties || [];

                if (bounties.length === 0) {
                    return interaction.followUp({ embeds: [new EmbedBuilder().setDescription(`✅ <@${target.id}> is clean! They have no active bounties on their head.`).setColor(EconomyConfig.successColor)] });
                }

                const totalBounty = bounties.reduce((sum, b) => sum + b.amount, 0);

                const embed = new EmbedBuilder()
                    .setTitle(`🎯 Active Bounties: ${target.username}`)
                    .setDescription(`<@${target.id}> has a total bounty of ${EconomyConfig.currencySymbol}**${totalBounty.toLocaleString()}** on their head!`)
                    .setColor(EconomyConfig.failColor)
                    .setThumbnail(target.displayAvatarURL({ dynamic: true }));

                let bountyText = '';
                const displayCount = Math.min(bounties.length, 10);
                
                // Show latest bounties
                const sortedBounties = [...bounties].sort((a, b) => b.timestamp - a.timestamp);
                for (let i = 0; i < displayCount; i++) {
                    const b = sortedBounties[i];
                    const placer = b.placedBy === 'System' ? '🚨 **System**' : `<@${b.placedBy}>`;
                    bountyText += `> ${EconomyConfig.currencySymbol}**${b.amount.toLocaleString()}** — Placed by ${placer} <t:${Math.floor(b.timestamp.getTime() / 1000)}:R>\n`;
                }

                if (bounties.length > 10) {
                    bountyText += `> *...and ${bounties.length - 10} more bounties.*`;
                }

                embed.addFields({ name: 'Recent Bounties', value: bountyText });

                return interaction.followUp({ embeds: [embed] });

            } else if (subcommand === 'list') {
                // Find users with the highest total bounties
                const allUsers = await EconomyUser.find({ 'bounties.0': { $exists: true } });
                
                const wantedList = allUsers.map(user => {
                    const totalBounty = user.bounties.reduce((sum, b) => sum + b.amount, 0);
                    return { userId: user.userId, totalBounty };
                }).filter(u => u.totalBounty > 0).sort((a, b) => b.totalBounty - a.totalBounty).slice(0, 10);

                if (wantedList.length === 0) {
                    return interaction.followUp({ embeds: [new EmbedBuilder().setDescription('✅ The server is peaceful... There are no active bounties!').setColor(EconomyConfig.successColor)] });
                }

                const embed = new EmbedBuilder()
                    .setTitle('🚨 Most Wanted Players')
                    .setDescription('The players with the highest bounties on their heads right now!')
                    .setColor(EconomyConfig.failColor);

                let listText = '';
                for (let i = 0; i < wantedList.length; i++) {
                    const w = wantedList[i];
                    listText += `**${i + 1}.** <@${w.userId}> — ${EconomyConfig.currencySymbol}**${w.totalBounty.toLocaleString()}**\n`;
                }

                embed.addFields({ name: 'The List', value: listText });

                return interaction.followUp({ embeds: [embed] });

            } else if (subcommand === 'payoff') {
                const target = interaction.options.getUser('target');
                const amountStr = interaction.options.getString('amount');

                if (target.bot) return interaction.followUp(ComponentUtils.createError('Bots do not have bounties!'));

                const targetData = await EconomyUtils.getUser(target.id);
                const totalBounty = await EconomyUtils.getTotalBounty(target.id);

                if (totalBounty <= 0) {
                    return interaction.followUp(ComponentUtils.createError(`<@${target.id}> does not have any active bounties to pay off!`));
                }

                const userData = await EconomyUtils.getUser(interaction.user.id);
                
                let amountToPay;
                if (amountStr.toLowerCase() === 'all' || amountStr.toLowerCase() === 'max') {
                    if (userData.wallet <= 0) {
                        return interaction.followUp(ComponentUtils.createError('Your wallet is empty! You have no money to pay off the bounty.'));
                    }
                    amountToPay = Math.min(totalBounty, userData.wallet);
                } else {
                    amountToPay = parseAmount(amountStr, userData.wallet);
                }

                if (amountToPay === 0 && (amountStr.toLowerCase() === 'max' || amountStr.toLowerCase() === 'all')) {
                    return interaction.followUp(ComponentUtils.createError('Your wallet is empty! You have no money to pay off the bounty.'));
                }

                if (amountToPay <= 0 || isNaN(amountToPay)) {
                    return interaction.followUp(ComponentUtils.createError('Please provide a valid amount to pay off.'));
                }

                const minBounty = EconomyConfig.bounty.minAmount || 1000;
                if (amountToPay < minBounty && amountToPay < totalBounty) {
                    return interaction.followUp(ComponentUtils.createError(`The minimum payoff amount is **${EconomyConfig.currencySymbol}${minBounty.toLocaleString()}** (unless the remaining bounty is lower).`));
                }

                if (userData.wallet < amountToPay) {
                    return interaction.followUp(ComponentUtils.createError(`You do not have enough money in your wallet! You need **${EconomyConfig.currencySymbol}${amountToPay.toLocaleString()}**.`));
                }

                if (amountToPay > totalBounty) {
                    amountToPay = totalBounty; // Don't overpay
                }

                // Deduct money from payer
                await EconomyUtils.removeCash(interaction.user.id, amountToPay);
                
                // Pay off the bounty
                const paidOff = await EconomyUtils.payoffBounty(target.id, amountToPay);

                const embed = new EmbedBuilder()
                    .setTitle('💸 Bounty Paid Off!')
                    .setDescription(`You successfully paid off ${EconomyConfig.currencySymbol}**${paidOff.toLocaleString()}** of <@${target.id}>'s bounty!`)
                    .setColor(EconomyConfig.successColor);
                
                const remaining = totalBounty - paidOff;
                if (remaining <= 0) {
                    embed.addFields({ name: 'Status', value: `> ✅ Their bounty is completely cleared! They are a free citizen.` });
                } else {
                    embed.addFields({ name: 'Status', value: `> ⚠️ They still have a bounty of ${EconomyConfig.currencySymbol}**${remaining.toLocaleString()}** remaining on their head.` });
                }

                return interaction.followUp({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Bounty Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while executing the bounty command.'));
        }
    }
};
