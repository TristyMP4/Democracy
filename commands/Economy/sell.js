const { SlashCommandBuilder, ContainerBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Sell an item from your inventory for money.')
        .addStringOption(option => 
            option.setName('item')
                .setDescription('The item you want to sell')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of this item to sell (default 1)')
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        let userData = await EconomyUtils.getUser(interaction.user.id);
        let choices = [];

        if (userData && userData.inventory) {
            for (const [itemId, quantity] of userData.inventory.entries()) {
                if (quantity > 0) {
                    const itemConfig = EconomyConfig.items[itemId];
                    if (itemConfig && itemConfig.sellable) {
                        choices.push({ name: itemConfig.name, value: itemId });
                    }
                }
            }
        }

        // Filter based on focused value and limit to 25
        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue)).slice(0, 25);
        await interaction.respond(filtered);
    },

    async execute(interaction) {
        await interaction.deferReply();
        
        const settings = await EconomyUtils.getSettings();

        const itemInput = interaction.options.getString('item').toLowerCase();
        let amount = interaction.options.getInteger('amount') || 1;

        if (amount <= 0) {
            return interaction.followUp(ComponentUtils.createError('You must sell at least 1.'));
        }

        // Validate item exists in economy
        const itemConfig = EconomyConfig.items[itemInput];
        if (!itemConfig) {
            return interaction.followUp(ComponentUtils.createError(`That item does not exist! Try checking your \`/inventory\` for the correct name.`));
        }

        const totalValue = itemConfig.price * amount;

        try {
            let userData = await EconomyUtils.getUser(interaction.user.id);
            if (!userData || !userData.inventory || !userData.inventory.get(itemInput) || userData.inventory.get(itemInput) < amount) {
                return interaction.followUp(ComponentUtils.createError(`You do not have enough **${itemConfig.name}** to sell!`));
            }

            const moneyResult = await EconomyUtils.calculateMoney(totalValue);
            const finalValue = moneyResult.finalAmount;

            // Deduct from inventory
            await EconomyUtils.removeItem(interaction.user.id, itemInput, amount);

            // Add money
            await EconomyUtils.addCash(interaction.user.id, finalValue, 'wallet');

            const titleDisplay = ComponentUtils.createText(`### 🛒 **${interaction.user.displayName}'s Sale Receipt**`);
            const descDisplay = ComponentUtils.createText(`${interaction.user} sold **${amount.toLocaleString()}x** ${itemConfig.emoji} **${itemConfig.name}** and got paid **${EconomyConfig.currencySymbol}${finalValue.toLocaleString()}**!`);
            
            let footerDisplay = null;
            if ((settings.moneyMultiplier || 1.0) > 1) {
                const bonusAmount = finalValue - totalValue;
                footerDisplay = ComponentUtils.createText(`-# Money Multiplier: ${settings.moneyMultiplier} (+ ${EconomyConfig.currencySymbol}${bonusAmount.toLocaleString()})`);
            }

            const container = new ContainerBuilder()
                .addTextDisplayComponents(titleDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addTextDisplayComponents(descDisplay);
            
            if (footerDisplay) {
                container.addSeparatorComponents(ComponentUtils.createSeparator());
                container.addTextDisplayComponents(footerDisplay);
            }
            await interaction.followUp(ComponentUtils.createContainerResponse(container));

        } catch (error) {
            console.error('Sell Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while selling the item.'));
        }
    }
};
