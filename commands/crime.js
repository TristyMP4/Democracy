const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyUser = require('../schemas/EconomyUser.js');
const EconomySettings = require('../schemas/EconomySettings.js');
const EconomyConfig = require('../utils/EconomyConfig.js');

module.exports = {
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
                return interaction.followUp({ content: `🚓 Lay low! You can commit another crime in **${remaining}s**.` });
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
                let reward = Math.floor(Math.random() * (crimeConfig.maxReward - crimeConfig.minReward + 1)) + crimeConfig.minReward;
                
                // Apply global money multiplier
                reward = Math.floor(reward * settings.moneyMultiplier);

                userData.wallet += reward;
                await userData.save();

                const messageTemplate = crimeConfig.successMessages[Math.floor(Math.random() * crimeConfig.successMessages.length)];
                const message = messageTemplate.replace('${amount}', `$${reward.toLocaleString()}`);

                const embed = new EmbedBuilder()
                    .setTitle('🦹 Crime Successful')
                    .setDescription(message)
                    .setColor(EconomyConfig.successColor);

                return interaction.followUp({ embeds: [embed] });

            } else {
                // Failed - Calculate fine
                let fine = Math.floor(userData.wallet * crimeConfig.finePercentage);
                if (fine < 100) fine = 100; // Minimum fine
                
                // You can't go below 0
                if (userData.wallet < fine) {
                    fine = userData.wallet;
                }

                userData.wallet -= fine;
                await userData.save();

                const messageTemplate = crimeConfig.failMessages[Math.floor(Math.random() * crimeConfig.failMessages.length)];
                const message = messageTemplate.replace('${fine}', `$${fine.toLocaleString()}`);

                const embed = new EmbedBuilder()
                    .setTitle('🚓 Busted')
                    .setDescription(message)
                    .setColor(EconomyConfig.failColor);

                return interaction.followUp({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Crime Error:', error);
            await interaction.followUp({ content: '❌ An error occurred while trying to commit a crime.' });
        }
    }
};
