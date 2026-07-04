const { SlashCommandBuilder, ContainerBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
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
        const itemInput = interaction.options.getString('item').toLowerCase();

        // Validate item exists in economy
        const itemConfig = EconomyConfig.items[itemInput];
        if (!itemConfig) {
            return interaction.reply(ComponentUtils.createError(`That item does not exist! Try checking your \`/inventory\` for the correct name.`));
        }

        try {
            let userData = await EconomyUtils.getUser(interaction.user.id);
            if (!userData || !userData.inventory || !userData.inventory.get(itemInput) || userData.inventory.get(itemInput) < 1) {
                return interaction.reply(ComponentUtils.createError(`You do not have enough **${itemConfig.name}** to sell!`));
            }

            // Create Modal
            const modal = new ModalBuilder()
                .setCustomId(`sell_modal_${itemInput}`)
                .setTitle(`Sell ${itemConfig.name}`);

            const quantityInput = new TextInputBuilder()
                .setCustomId('quantity')
                .setLabel('Quantity to sell')
                .setStyle(TextInputStyle.Short)
                .setValue('1')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(quantityInput));

            await interaction.showModal(modal);

            // Wait for modal submit
            const submitted = await interaction.awaitModalSubmit({
                time: 60000,
                filter: i => i.user.id === interaction.user.id && i.customId === `sell_modal_${itemInput}`
            }).catch(() => null);

            if (!submitted) return;

            let amount = parseInt(submitted.fields.getTextInputValue('quantity'));
            if (isNaN(amount) || amount <= 0) {
                return submitted.reply(ComponentUtils.createError('Invalid quantity! Must be a number greater than 0.'));
            }

            await submitted.deferReply();

            // Re-fetch user to prevent race conditions during modal wait
            userData = await EconomyUtils.getUser(interaction.user.id);
            if (!userData || !userData.inventory || !userData.inventory.get(itemInput) || userData.inventory.get(itemInput) < amount) {
                return submitted.followUp(ComponentUtils.createError(`You do not have enough **${itemConfig.name}** to sell that many!`));
            }

            const totalValue = itemConfig.price * amount;
            const settings = await EconomyUtils.getSettings();
            
            const moneyResult = await EconomyUtils.calculateMoney(totalValue, interaction.user.id);
            const finalValue = moneyResult.finalAmount;

            // Deduct from inventory
            await EconomyUtils.removeItem(interaction.user.id, itemInput, amount);

            // Add money
            await EconomyUtils.addCash(interaction.user.id, finalValue, 'wallet');

            const titleDisplay = ComponentUtils.createText(`### 🛒 **${interaction.user.displayName}'s Sale Receipt**`);
            const descDisplay = ComponentUtils.createText(`${interaction.user} sold **${amount.toLocaleString()}x** ${itemConfig.emoji} **${itemConfig.name}** and got paid **${EconomyConfig.currencySymbol}${finalValue.toLocaleString()}**!`);
            
            let footerDisplay = null;
            if (moneyResult.multiplier > 1) {
                const bonusAmount = finalValue - totalValue;
                footerDisplay = ComponentUtils.createText(`-# Money Multiplier: ${moneyResult.multiplier} (+ ${EconomyConfig.currencySymbol}${bonusAmount.toLocaleString()})`);
            }

            const container = new ContainerBuilder()
                .addTextDisplayComponents(titleDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addTextDisplayComponents(descDisplay);
            
            if (footerDisplay) {
                container.addSeparatorComponents(ComponentUtils.createSeparator());
                container.addTextDisplayComponents(footerDisplay);
            }
            await submitted.followUp(ComponentUtils.createContainerResponse(container));

        } catch (error) {
            console.error('Sell Error:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(ComponentUtils.createError('❌ An error occurred while selling the item.')).catch(() => {});
            } else {
                await interaction.reply(ComponentUtils.createError('❌ An error occurred while selling the item.')).catch(() => {});
            }
        }
    }
};
