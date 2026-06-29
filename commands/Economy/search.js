const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomySettings = require('../../schemas/EconomySettings.js');
const EconomyConfig = require('../../utils/EconomyConfig.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search a location for money.'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            let userData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!userData) {
                userData = new EconomyUser({ userId: interaction.user.id });
            }

            // Cooldown check (30 seconds)
            const cooldownTime = 30 * 1000;
            if (userData.lastSearch && (Date.now() - userData.lastSearch.getTime()) < cooldownTime) {
                const remaining = Math.ceil((cooldownTime - (Date.now() - userData.lastSearch.getTime())) / 1000);
                return interaction.followUp({ content: `⏱️ You're still tired from your last search. Try again in **${remaining}s**.` });
            }

            userData.lastSearch = new Date();
            await userData.save();

            // Pick 3 random locations
            const shuffledLocations = [...EconomyConfig.searchLocations].sort(() => 0.5 - Math.random());
            const options = shuffledLocations.slice(0, 3);

            const row = new ActionRowBuilder();
            options.forEach((loc, index) => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`search_${index}`)
                        .setLabel(loc.name)
                        .setEmoji(loc.emoji)
                        .setStyle(ButtonStyle.Primary)
                );
            });

            const embed = new EmbedBuilder()
                .setTitle('🔍 Search for Loot')
                .setDescription('Where do you want to search? Click a button below!')
                .setColor(EconomyConfig.embedColor);

            const message = await interaction.followUp({ embeds: [embed], components: [row] });

            // Create Collector
            const collector = message.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 15000,
                filter: i => i.user.id === interaction.user.id 
            });

            collector.on('collect', async i => {
                // Disable buttons
                const disabledRow = new ActionRowBuilder();
                options.forEach((loc, index) => {
                    disabledRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`search_${index}`)
                            .setLabel(loc.name)
                            .setEmoji(loc.emoji)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true)
                    );
                });

                await i.update({ components: [disabledRow] });
                collector.stop('clicked');

                const choiceIndex = parseInt(i.customId.split('_')[1]);
                const chosenLocation = options[choiceIndex];

                // Fetch Global Multipliers
                let settings = await EconomySettings.findOne({ id: 'global' });
                if (!settings) {
                    settings = new EconomySettings();
                    await settings.save();
                }

                // Calculate chance
                const chance = Math.random();
                const requiredChance = 1 - (chosenLocation.successChance * settings.luckMultiplier);
                
                const isSuccess = chance >= requiredChance;

                // Make sure we fetch the latest user data to prevent desync
                userData = await EconomyUser.findOne({ userId: interaction.user.id });

                if (isSuccess) {
                    let reward = Math.floor(Math.random() * (chosenLocation.maxReward - chosenLocation.minReward + 1)) + chosenLocation.minReward;
                    reward = Math.floor(reward * settings.moneyMultiplier);

                    userData.wallet += reward;
                    await userData.save();

                    const msgTemplate = chosenLocation.successMessages[Math.floor(Math.random() * chosenLocation.successMessages.length)];
                    const resultMessage = msgTemplate.replace('${amount}', `$${reward.toLocaleString()}`);

                    const resultEmbed = new EmbedBuilder()
                        .setTitle(`🔍 Searched: ${chosenLocation.name}`)
                        .setDescription(resultMessage)
                        .setColor(EconomyConfig.successColor);

                    await interaction.editReply({ embeds: [resultEmbed] });
                } else {
                    const msgTemplate = chosenLocation.failMessages[Math.floor(Math.random() * chosenLocation.failMessages.length)];
                    
                    const resultEmbed = new EmbedBuilder()
                        .setTitle(`🔍 Searched: ${chosenLocation.name}`)
                        .setDescription(msgTemplate)
                        .setColor(EconomyConfig.failColor);

                    await interaction.editReply({ embeds: [resultEmbed] });
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    // Time out
                    const disabledRow = new ActionRowBuilder();
                    options.forEach((loc, index) => {
                        disabledRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`search_${index}`)
                                .setLabel(loc.name)
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        );
                    });

                    await interaction.editReply({ 
                        content: '⏱️ You took too long to choose a location!', 
                        embeds: [], 
                        components: [disabledRow] 
                    }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Search Error:', error);
            await interaction.editReply({ content: '❌ An error occurred while searching.' }).catch(() => {});
        }
    }
};
