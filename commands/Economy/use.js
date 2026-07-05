const { SlashCommandBuilder, ContainerBuilder, EmbedBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Use an item from your inventory.')
        .addStringOption(option => {
            const opt = option.setName('item')
                .setDescription('The item to use')
                .setRequired(true);
            
            // Build choices dynamically from config
            Object.keys(EconomyConfig.items).forEach(key => {
                if (EconomyConfig.items[key].usable) {
                    opt.addChoices({ name: EconomyConfig.items[key].name, value: key });
                }
            });
            return opt;
        })
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to target (required for weapons)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const itemId = interaction.options.getString('item');
        const itemConfig = EconomyConfig.items[itemId];

        try {
            if (!itemConfig) {
                return interaction.followUp(ComponentUtils.createError(`That item does not exist! Try checking your \`/inventory\` for the correct ID.`));
            }

            let userData = await EconomyUtils.getUser(interaction.user.id);
            if (!userData.inventory || !userData.inventory.get(itemId) || userData.inventory.get(itemId) < 1) {
                return interaction.followUp(ComponentUtils.createError(`You do not have a **${itemConfig.name}** in your inventory!`));
            }

            // We do not consume guns automatically, they only break on durability rolls
            const isGun = itemConfig.damagePercentage !== undefined;
            if (!isGun) {
                await EconomyUtils.removeItem(interaction.user.id, itemId, 1);
            }

            if (isGun) {
                const target = interaction.options.getUser('target');
                if (!target) {
                    return interaction.followUp(ComponentUtils.createError('You must specify a `target` to shoot a gun!'));
                }
                if (target.bot) {
                    return interaction.followUp(ComponentUtils.createError('You cannot shoot a bot!'));
                }
                if (target.id === interaction.user.id) {
                    return interaction.followUp(ComponentUtils.createError('You cannot shoot yourself!'));
                }
                
                // Check ammo
                const requiredAmmo = itemConfig.ammo[0];
                if (!userData.inventory || !userData.inventory.get(requiredAmmo) || userData.inventory.get(requiredAmmo) < 1) {
                    const ammoName = EconomyConfig.items[requiredAmmo].name;
                    return interaction.followUp(ComponentUtils.createError(`You need at least 1x **${ammoName}** to fire the ${itemConfig.name}!`));
                }

                // Consume 1 ammo
                await EconomyUtils.removeItem(interaction.user.id, requiredAmmo, 1);

                // Roll for hit/miss using damagePercentage and shooter's Luck Multiplier
                const hitRollResult = await EconomyUtils.calculateLuckRoll(itemConfig.damagePercentage, interaction.user.id);
                const isHit = hitRollResult.isSuccess;

                // Roll for durability
                const durabilityChance = itemConfig.durabilityPercentage;
                const breaks = Math.random() >= durabilityChance;

                let actionText = '';
                
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('🔫 You were shot at!')
                        .setColor(isHit ? EconomyConfig.failColor : EconomyConfig.successColor);

                    if (isHit) {
                        dmEmbed.setDescription(`**${interaction.user.username}** shot you with their ${itemConfig.name} and **killed you**!`);
                    } else {
                        dmEmbed.setDescription(`**${interaction.user.username}** shot at you with their ${itemConfig.name} but **missed**! You survived!`);
                    }
                    await target.send({ embeds: [dmEmbed] });
                } catch (e) {
                    // Ignore DM errors
                }
                
                if (isHit) {
                    // Kill target
                    const deathResult = await EconomyUtils.handleDeath(target.id);
                    actionText = `💥 **BOOM!** You shot <@${target.id}> with the ${itemConfig.name} and killed them!\n${deathResult.message}`;
                } else {
                    actionText = `💨 **WHOOSH!** You shot at <@${target.id}> with the ${itemConfig.name} but missed!`;
                }

                if (breaks) {
                    // Break the gun
                    await EconomyUtils.removeItem(interaction.user.id, itemId, 1);
                    actionText += `\n> 🔧 **Snap!** Your ${itemConfig.name} broke after the shot!`;
                }

                const container = new ContainerBuilder()
                    .setAccentColor(isHit ? EconomyConfig.failColor : 0x2b2d31) // subtle grey or fail red
                    .addTextDisplayComponents(ComponentUtils.createText(`### 🔫 **Shots Fired!**`))
                    .addSeparatorComponents(ComponentUtils.createSeparator())
                    .addTextDisplayComponents(ComponentUtils.createText(actionText));

                return interaction.followUp(ComponentUtils.createContainerResponse(container));
            }

            // Execute custom logic based on item
            if (itemId === 'supply-signal') {
                // Determine 1 to 3 items
                const numItems = Math.floor(Math.random() * 3) + 1;
                // Pre-calculate global total item weight for the drops
                const allItemKeys = Object.keys(EconomyConfig.items);
                let totalWeight = 0;
                const itemWeights = [];
                for (const key of allItemKeys) {
                    const w = EconomyConfig.items[key].dropWeight || 100;
                    totalWeight += w;
                    itemWeights.push({ key, weight: w });
                }

                let receivedText = '';
                for (let i = 0; i < numItems; i++) {
                    let itemRandom = Math.random() * totalWeight;
                    let randomKey = allItemKeys[0];
                    
                    for (const iw of itemWeights) {
                        if (itemRandom < iw.weight) {
                            randomKey = iw.key;
                            break;
                        }
                        itemRandom -= iw.weight;
                    }

                    const receivedItem = EconomyConfig.items[randomKey];
                    
                    // Add to inventory
                    await EconomyUtils.addItem(interaction.user.id, randomKey, 1);

                    receivedText += `${receivedItem.emoji} **${receivedItem.name}**\n`;
                }

                const titleDisplay = ComponentUtils.createText(`### 🛩️ **Supply Drop Used!**`);
                const descDisplay = ComponentUtils.createText(`-# You threw the Supply Signal and a cargo plane dropped off a crate!\n\n**You received:**\n${receivedText}`);

                const container = new ContainerBuilder()
                    .setAccentColor(EconomyConfig.successColor)
                    .addTextDisplayComponents(titleDisplay)
                    .addSeparatorComponents(ComponentUtils.createSeparator())
                    .addTextDisplayComponents(descDisplay);

                return interaction.followUp(ComponentUtils.createContainerResponse(container));
            }

            if (itemId === 'weed') {
                const currentMultiplier = (userData.luckExpiry && userData.luckExpiry > new Date()) ? (userData.luckMultiplier || 1.0) : 1.0;
                
                const isPositive = Math.random() >= 0.5;
                const diff = isPositive ? 0.5 : -0.5;
                
                const expiry = new Date();
                expiry.setMinutes(expiry.getMinutes() + 10);
                
                userData.luckMultiplier = currentMultiplier + diff;
                userData.luckExpiry = expiry;
                await userData.save();
                
                let textDesc = '';
                if (isPositive) {
                    textDesc = `You smoked the Weed and suddenly feel hyper-focused! Your individual luck multiplier has **increased** (+0.5x) to a total of **${userData.luckMultiplier.toFixed(1)}x** for the next 10 minutes!`;
                } else {
                    textDesc = `You smoked the Weed but it was laced with something foul... You feel sluggish and your individual luck multiplier has **decreased** (-0.5x) to a total of **${userData.luckMultiplier.toFixed(1)}x** for the next 10 minutes!`;
                }
                
                const titleDisplay = ComponentUtils.createText(`### 🌿 **You smoked some Weed**`);
                const descDisplay = ComponentUtils.createText(`-# ${textDesc}`);

                const container = new ContainerBuilder()
                    .setAccentColor(isPositive ? EconomyConfig.successColor : EconomyConfig.failColor)
                    .addTextDisplayComponents(titleDisplay)
                    .addSeparatorComponents(ComponentUtils.createSeparator())
                    .addTextDisplayComponents(descDisplay);

                return interaction.followUp(ComponentUtils.createContainerResponse(container));
            }

            if (itemId === 'milk') {
                userData.luckMultiplier = 1.0;
                userData.luckExpiry = null;
                
                userData.moneyMultiplier = 1.0;
                userData.moneyExpiry = null;
                
                userData.cooldownMultiplier = 1.0;
                userData.cooldownExpiry = null;
                
                await userData.save();
                
                const titleDisplay = ComponentUtils.createText(`### 🥛 **You drank some Milk**`);
                const descDisplay = ComponentUtils.createText(`-# Ah, refreshing! All of your active personal effects (luck, money, and cooldown multipliers) have been completely neutralized and wiped clean.`);

                const container = new ContainerBuilder()
                    .setAccentColor(EconomyConfig.successColor)
                    .addTextDisplayComponents(titleDisplay)
                    .addSeparatorComponents(ComponentUtils.createSeparator())
                    .addTextDisplayComponents(descDisplay);

                return interaction.followUp(ComponentUtils.createContainerResponse(container));
            }

            if (itemId === 'sinsimito-tequila') {
                const currentMultiplier = (userData.luckExpiry && userData.luckExpiry > new Date()) ? (userData.luckMultiplier || 1.0) : 1.0;
                
                const diff = 2.0;
                
                const expiry = new Date();
                expiry.setMinutes(expiry.getMinutes() + 10);
                
                userData.luckMultiplier = currentMultiplier + diff;
                userData.luckExpiry = expiry;
                await userData.save();
                
                const textDesc = `You drank the Sinsimito Tequila and feel invincible! Your individual luck multiplier has **massively increased** (+2.0x) to a total of **${userData.luckMultiplier.toFixed(1)}x** for the next 10 minutes!`;
                
                const titleDisplay = ComponentUtils.createText(`### 🥃 **You drank Sinsimito Tequila**`);
                const descDisplay = ComponentUtils.createText(`-# ${textDesc}`);

                const container = new ContainerBuilder()
                    .setAccentColor(EconomyConfig.successColor)
                    .addTextDisplayComponents(titleDisplay)
                    .addSeparatorComponents(ComponentUtils.createSeparator())
                    .addTextDisplayComponents(descDisplay);

                return interaction.followUp(ComponentUtils.createContainerResponse(container));
            }

            if (itemId === 'lucky-coin') {
                const currentMultiplier = (userData.moneyExpiry && userData.moneyExpiry > new Date()) ? (userData.moneyMultiplier || 1.0) : 1.0;
                
                const isPositive = Math.random() >= 0.5;
                const diff = isPositive ? 0.5 : -0.5;
                
                const expiry = new Date();
                expiry.setMinutes(expiry.getMinutes() + 10);
                
                userData.moneyMultiplier = currentMultiplier + diff;
                userData.moneyExpiry = expiry;
                await userData.save();
                
                let textDesc = '';
                if (isPositive) {
                    textDesc = `You flipped the Lucky Coin and it landed on **Heads**! Your individual money multiplier has **increased** (+0.5x) to a total of **${userData.moneyMultiplier.toFixed(1)}x** for the next 10 minutes!`;
                } else {
                    textDesc = `You flipped the Lucky Coin and it landed on **Tails**... Your individual money multiplier has **decreased** (-0.5x) to a total of **${userData.moneyMultiplier.toFixed(1)}x** for the next 10 minutes!`;
                }
                
                const titleDisplay = ComponentUtils.createText(`### 🪙 **You flipped a Lucky Coin**`);
                const descDisplay = ComponentUtils.createText(`-# ${textDesc}`);

                const container = new ContainerBuilder()
                    .setAccentColor(isPositive ? EconomyConfig.successColor : EconomyConfig.failColor)
                    .addTextDisplayComponents(titleDisplay)
                    .addSeparatorComponents(ComponentUtils.createSeparator())
                    .addTextDisplayComponents(descDisplay);

                return interaction.followUp(ComponentUtils.createContainerResponse(container));
            }

            // Fallback for generic items
            const fallbackTitle = ComponentUtils.createText(`### ✅ **Item Used**`);
            const fallbackDesc = ComponentUtils.createText(`-# You used **${itemConfig.name}**.`);
            const fallbackContainer = new ContainerBuilder()
                .setAccentColor(EconomyConfig.successColor)
                .addTextDisplayComponents(fallbackTitle)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addTextDisplayComponents(fallbackDesc);

            await interaction.followUp(ComponentUtils.createContainerResponse(fallbackContainer));

        } catch (error) {
            console.error('Use Error:', error);
            await interaction.followUp(ComponentUtils.createError('An error occurred while using the item.'));
        }
    }
};
