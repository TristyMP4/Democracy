const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('Commit a random crime. High risk, high reward.'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            let user = await EconomyUtils.getUser(interaction.user.id);

            const cooldownTime = 60 * 1000;
            if (user.lastCrime && (Date.now() - user.lastCrime.getTime()) < cooldownTime) {
                const remaining = Math.ceil((cooldownTime - (Date.now() - user.lastCrime.getTime())) / 1000);
                return interaction.followUp(ComponentUtils.createError(`You're too hot right now! Lie low for **${remaining}s**.`));
            }

            user.lastCrime = new Date();
            await user.save(); // Save cooldown immediately so they can't spam while it processes

            const crimeConfig = EconomyConfig.crime;
            const rollResult = await EconomyUtils.calculateLuckRoll(crimeConfig.successChance);

            if (rollResult.isSuccess) {
                let baseReward = Math.floor(Math.random() * (crimeConfig.maxReward - crimeConfig.minReward + 1)) + crimeConfig.minReward;
                const moneyResult = await EconomyUtils.calculateMoney(baseReward);

                await EconomyUtils.addCash(interaction.user.id, moneyResult.finalAmount, 'wallet');

                const outcomeObj = crimeConfig.successMessages[Math.floor(Math.random() * crimeConfig.successMessages.length)];
                const message = outcomeObj.message.replace('${amount}', `${EconomyConfig.currencySymbol}${moneyResult.finalAmount.toLocaleString()}`);

                let footerText = outcomeObj.signature;
                if (moneyResult.multiplier > 1 && moneyResult.bonus > 0) {
                    footerText += ` | Money Multiplier: ${moneyResult.multiplier} (+ ${EconomyConfig.currencySymbol}${moneyResult.bonus.toLocaleString()})`;
                }

                const embed = new EmbedBuilder()
                    .setTitle('🥷 Crime Successful')
                    .setDescription(message)
                    .setColor(EconomyConfig.successColor)
                    .setFooter({ text: footerText });

                return interaction.followUp({ embeds: [embed] });

            } else {
                user = await EconomyUtils.getUser(interaction.user.id);
                
                const outcomeObj = crimeConfig.failMessages[Math.floor(Math.random() * crimeConfig.failMessages.length)];
                const deathChance = outcomeObj.deathChance || 0;

                if (Math.random() < deathChance) {
                    await EconomyUtils.handleDeath(interaction.user.id);
                    
                    let fine = Math.floor((user.wallet + user.bank) * crimeConfig.finePercentage);
                    if (fine < 100) fine = 100;
                    
                    const msgTemplate = outcomeObj.message.replace('${fine}', `${EconomyConfig.currencySymbol}${fine.toLocaleString()}`);
                    const desc = `${msgTemplate}\n\n> **You were killed in the crossfire! Your wallet and inventory were wiped.**`;

                    const embed = new EmbedBuilder()
                        .setTitle('💀 Wasted')
                        .setDescription(desc)
                        .setColor(EconomyConfig.failColor)
                        .setFooter({ text: outcomeObj.signature });
                    return interaction.followUp({ embeds: [embed] });
                }
                
                let fine = Math.floor((user.wallet + user.bank) * crimeConfig.finePercentage);
                if (fine < 100) fine = 100; // Minimum fine
                
                const { actualRemoved } = await EconomyUtils.removeCash(interaction.user.id, fine, 'cascade');

                const message = outcomeObj.message.replace('${fine}', `${EconomyConfig.currencySymbol}${actualRemoved.toLocaleString()}`);

                const embed = new EmbedBuilder()
                    .setTitle('🚓 Busted')
                    .setDescription(message)
                    .setColor(EconomyConfig.failColor)
                    .setFooter({ text: outcomeObj.signature });

                return interaction.followUp({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Crime Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while committing a crime.'));
        }
    }
};
