const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomySettings = require('../../schemas/EconomySettings.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('Commit a random crime. High risk, high reward.'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            let userData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!userData) {
                userData = new EconomyUser({ userId: interaction.user.id });
            }

            // Cooldown check (60 seconds)
            const cooldownTime = 60 * 1000;
            if (userData.lastCrime && (Date.now() - userData.lastCrime.getTime()) < cooldownTime) {
                const remaining = Math.ceil((cooldownTime - (Date.now() - userData.lastCrime.getTime())) / 1000);
                return interaction.followUp(ComponentUtils.createError(`You're too hot right now! Lie low for **${remaining}s**.`));
            }

            // Update cooldown
            userData.lastCrime = new Date();

            // Fetch Global Multipliers
            let settings = await EconomySettings.findOne({ id: 'global' });
            if (!settings) {
                settings = new EconomySettings();
                await settings.save();
            }

            const crimeConfig = EconomyConfig.crime;
            
            // Luck determines success
            const chance = Math.random();
            const requiredChance = 1 - (crimeConfig.successChance * settings.luckMultiplier);
            
            const isSuccess = chance >= requiredChance;

            if (isSuccess) {
                // Base reward
                let baseReward = Math.floor(Math.random() * (crimeConfig.maxReward - crimeConfig.minReward + 1)) + crimeConfig.minReward;
                
                // Apply global money multiplier
                let reward = Math.floor(baseReward * settings.moneyMultiplier);

                userData.wallet += reward;
                await userData.save();

                const outcomeObj = crimeConfig.successMessages[Math.floor(Math.random() * crimeConfig.successMessages.length)];
                const message = outcomeObj.message.replace('${amount}', `${EconomyConfig.currencySymbol}${reward.toLocaleString()}`);

                let footerText = outcomeObj.signature;
                if (settings.moneyMultiplier > 1 && reward > baseReward) {
                    const bonusAmount = reward - baseReward;
                    footerText += ` | Money Multiplier: ${settings.moneyMultiplier} (+ ${EconomyConfig.currencySymbol}${bonusAmount.toLocaleString()})`;
                }

                const embed = new EmbedBuilder()
                    .setTitle('🥷 Crime Successful')
                    .setDescription(message)
                    .setColor(EconomyConfig.successColor)
                    .setFooter({ text: footerText });

                return interaction.followUp({ embeds: [embed] });

            } else {
                // Failed - Calculate fine (based on total wealth to prevent stashing loopholes)
                let fine = Math.floor((userData.wallet + userData.bank) * crimeConfig.finePercentage);
                if (fine < 100) fine = 100; // Minimum fine
                
                let remainingFine = fine;

                if (userData.wallet >= remainingFine) {
                    userData.wallet -= remainingFine;
                    remainingFine = 0;
                } else {
                    remainingFine -= userData.wallet;
                    userData.wallet = 0;
                    
                    if (userData.bank >= remainingFine) {
                        userData.bank -= remainingFine;
                        remainingFine = 0;
                    } else {
                        remainingFine -= userData.bank;
                        userData.bank = 0;
                    }
                }

                const actualFinePaid = fine - remainingFine;
                await userData.save();

                const outcomeObj = crimeConfig.failMessages[Math.floor(Math.random() * crimeConfig.failMessages.length)];
                const message = outcomeObj.message.replace('${fine}', `${EconomyConfig.currencySymbol}${actualFinePaid.toLocaleString()}`);

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
