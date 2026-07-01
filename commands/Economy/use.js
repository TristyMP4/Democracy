const { SlashCommandBuilder, ContainerBuilder } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

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
        }),

    async execute(interaction) {
        await interaction.deferReply();

        const itemId = interaction.options.getString('item');
        const itemConfig = EconomyConfig.items[itemId];

        try {
            let userData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!itemConfig) {
                return interaction.followUp(ComponentUtils.createError(`That item does not exist! Try checking your \`/inventory\` for the correct ID.`));
            }
            if (!userData || !userData.inventory || !userData.inventory.get(itemId) || userData.inventory.get(itemId) < 1) {
                return interaction.followUp(ComponentUtils.createError(`You do not have a **${itemConfig.name}** in your inventory!`));
            }

            // Consume item
            userData.inventory.set(itemId, userData.inventory.get(itemId) - 1);

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
                    const currentCount = userData.inventory.get(randomKey) || 0;
                    userData.inventory.set(randomKey, currentCount + 1);

                    receivedText += `${receivedItem.emoji} **${receivedItem.name}**\n`;
                }

                await userData.save();

                const titleDisplay = ComponentUtils.createText(`### 🚁 **Supply Drop Arrived!**`);
                const descDisplay = ComponentUtils.createText(`-# You threw the Supply Signal and a chopper dropped off a crate!\n\n**You received:**\n${receivedText}`);

                const container = new ContainerBuilder()
                    .setAccentColor(EconomyConfig.successColor)
                    .addTextDisplayComponents(titleDisplay)
                    .addSeparatorComponents(ComponentUtils.createSeparator())
                    .addTextDisplayComponents(descDisplay);

                return interaction.followUp(ComponentUtils.createContainerResponse(container));
            }

            // Fallback for generic items
            await userData.save();
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
