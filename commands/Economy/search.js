const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomySettings = require('../../schemas/EconomySettings.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    economy: true,
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

            // Cooldown check (15 seconds)
            const cooldownTime = 15 * 1000;
            if (userData.lastSearch && (Date.now() - userData.lastSearch.getTime()) < cooldownTime) {
                const remaining = Math.ceil((cooldownTime - (Date.now() - userData.lastSearch.getTime())) / 1000);
                return interaction.followUp(ComponentUtils.createError(`You're too tired to search again! Try again in **${remaining}s**.`));
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
                .setTitle('🔍 Where do you want to search?')
                .setDescription('*Pick an option below to start searching that location!*')
                .setColor(EconomyConfig.embedColor);

            const message = await interaction.followUp({ embeds: [embed], components: [row] });

            // Create Collector
            const collector = message.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 15000,
                filter: i => i.user.id === interaction.user.id 
            });

            collector.on('collect', async i => {
                try {
                    const choiceIndex = parseInt(i.customId.split('_')[1]);
                    const chosenLocation = options[choiceIndex];

                    // Disable buttons and turn the chosen one green
                    const disabledRow = new ActionRowBuilder();
                    options.forEach((loc, index) => {
                        const isChosen = index === choiceIndex;
                        disabledRow.addComponents(
                            ComponentUtils.createButton({
                                customId: `search_${index}`,
                                label: loc.name,
                                emoji: loc.emoji,
                                style: isChosen ? ButtonStyle.Success : ButtonStyle.Secondary,
                                disabled: true
                            })
                        );
                    });

                    await i.update({ components: [disabledRow] });
                    collector.stop('clicked');

                    // Fetch Global Multipliers
                    let settings = await EconomySettings.findOne({ id: 'global' });
                    if (!settings) {
                        settings = new EconomySettings();
                        await settings.save();
                    }

                    // Weighted RNG for outcomes (Luck boosts good outcomes)
                    const outcomesConfig = EconomyConfig.searchSettings.outcomes;
                    const luckMulti = settings.luckMultiplier || 1.0;
                    const weights = [
                        { type: 'moneyAndItem', weight: outcomesConfig.moneyAndItem * luckMulti },
                        { type: 'itemOnly', weight: outcomesConfig.itemOnly * luckMulti },
                        { type: 'moneyOnly', weight: outcomesConfig.moneyOnly * luckMulti },
                        { type: 'nothing', weight: outcomesConfig.nothing } // Luck doesn't boost bad outcomes
                    ];

                    const totalWeight = weights.reduce((acc, curr) => acc + curr.weight, 0);
                    let random = Math.random() * totalWeight;
                    let selectedOutcome = 'nothing';

                    for (const w of weights) {
                        if (random < w.weight) {
                            selectedOutcome = w.type;
                            break;
                        }
                        random -= w.weight;
                    }

                    // Make sure we fetch the latest user data to prevent desync
                    userData = await EconomyUser.findOne({ userId: interaction.user.id });
                    if (!userData.inventory) userData.inventory = new Map();

                    let rewardMoney = 0;
                    let baseReward = 0;
                    let droppedItem = null;

                    // Process Money
                    if (selectedOutcome === 'moneyAndItem' || selectedOutcome === 'moneyOnly') {
                        baseReward = Math.floor(Math.random() * (chosenLocation.maxReward - chosenLocation.minReward + 1)) + chosenLocation.minReward;
                        rewardMoney = Math.floor(baseReward * (settings.moneyMultiplier || 1.0));
                        userData.wallet += rewardMoney;
                    }

                    // Process Item
                    if (selectedOutcome === 'moneyAndItem' || selectedOutcome === 'itemOnly') {
                        if (chosenLocation.possibleItems && chosenLocation.possibleItems.length > 0) {
                            
                            // Calculate total weight of possible items for this location
                            let totalItemWeight = 0;
                            const itemWeights = [];
                            for (const key of chosenLocation.possibleItems) {
                                const weight = EconomyConfig.items[key].dropWeight || 100;
                                totalItemWeight += weight;
                                itemWeights.push({ key, weight });
                            }

                            let itemRandom = Math.random() * totalItemWeight;
                            let randomItemKey = chosenLocation.possibleItems[0]; // fallback
                            
                            for (const iw of itemWeights) {
                                if (itemRandom < iw.weight) {
                                    randomItemKey = iw.key;
                                    break;
                                }
                                itemRandom -= iw.weight;
                            }

                            droppedItem = EconomyConfig.items[randomItemKey];
                            
                            const currentCount = userData.inventory.get(randomItemKey) || 0;
                            userData.inventory.set(randomItemKey, currentCount + 1);
                        } else if (selectedOutcome === 'itemOnly') {
                            // Fallback to money if no items exist for this location
                            selectedOutcome = 'moneyOnly';
                            let reward = Math.floor(Math.random() * (chosenLocation.maxReward - chosenLocation.minReward + 1)) + chosenLocation.minReward;
                            rewardMoney = Math.floor(reward * (settings.moneyMultiplier || 1.0));
                            userData.wallet += rewardMoney;
                        }
                    }

                    await userData.save();

                    // Format the Result Embed
                    if (selectedOutcome === 'nothing') {
                        const outcomeObj = chosenLocation.failMessages[Math.floor(Math.random() * chosenLocation.failMessages.length)];
                        const msgTemplate = outcomeObj.message;
                        
                        const resultEmbed = new EmbedBuilder()
                            .setTitle(`🔍 ${interaction.user.username} searched ${chosenLocation.name}`)
                            .setDescription(msgTemplate)
                            .setColor(EconomyConfig.failColor)
                            .setFooter({ text: outcomeObj.signature });

                        await interaction.editReply({ embeds: [resultEmbed], components: [disabledRow] });
                    } else {
                        const outcomeObj = chosenLocation.successMessages[Math.floor(Math.random() * chosenLocation.successMessages.length)];
                        const msgTemplate = outcomeObj.message;
                        let resultMessage = msgTemplate.replace('${amount}', `${EconomyConfig.currencySymbol}${rewardMoney.toLocaleString()}`);

                        if (droppedItem && rewardMoney > 0) {
                            resultMessage += `\n> And you lucky ducky, you also found ${droppedItem.emoji} **${droppedItem.name}**!`;
                        } else if (droppedItem && rewardMoney === 0) {
                            resultMessage = `You searched ${chosenLocation.name} but couldn't find any cash.\nHowever, you did find ${droppedItem.emoji} **${droppedItem.name}**!`;
                        }

                        let footerText = outcomeObj.signature;
                        if ((settings.moneyMultiplier || 1.0) > 1 && rewardMoney > baseReward) {
                            const bonusAmount = rewardMoney - baseReward;
                            footerText += ` | Money Multiplier: ${settings.moneyMultiplier} (+ ${EconomyConfig.currencySymbol}${bonusAmount.toLocaleString()})`;
                        }

                        const resultEmbed = new EmbedBuilder()
                            .setTitle(`🔍 ${interaction.user.username} searched ${chosenLocation.name}`)
                            .setDescription(resultMessage)
                            .setColor(EconomyConfig.successColor)
                            .setFooter({ text: footerText });

                        await interaction.editReply({ embeds: [resultEmbed], components: [disabledRow] });
                    }
                } catch (err) {
                    console.error('Collector Error:', err);
                    await i.followUp({ content: `An error crashed the interaction: \`${err.message}\`\n${err.stack.split('\\n')[1]}`, ephemeral: true }).catch(() => {});
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

                    const lateEmbed = new EmbedBuilder()
                    .setDescription("Looks like you didn't want to search anywhere.")
                    .setColor(EconomyConfig.embedColor);

                    await interaction.editReply({ 
                        content: `❌ You took too long to choose a location!`,
                        components: [disabledRow],
                        embeds: []
                    }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Search Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while searching.'));
        }
    }
};
