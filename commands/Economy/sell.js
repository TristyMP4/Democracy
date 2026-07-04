const { SlashCommandBuilder, ContainerBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Sell up to 5 items from your inventory for money.')
        .addStringOption(option => 
            option.setName('item1')
                .setDescription('The first item you want to sell')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option => 
            option.setName('item2')
                .setDescription('The second item you want to sell')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .addStringOption(option => 
            option.setName('item3')
                .setDescription('The third item you want to sell')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .addStringOption(option => 
            option.setName('item4')
                .setDescription('The fourth item you want to sell')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .addStringOption(option => 
            option.setName('item5')
                .setDescription('The fifth item you want to sell')
                .setRequired(false)
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

        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue)).slice(0, 25);
        await interaction.respond(filtered);
    },

    async execute(interaction) {
        const itemsToSell = [];
        for (let i = 1; i <= 5; i++) {
            const itemInput = interaction.options.getString(`item${i}`);
            if (itemInput) itemsToSell.push(itemInput.toLowerCase());
        }

        const uniqueItems = [...new Set(itemsToSell)];

        try {
            let userData = await EconomyUtils.getUser(interaction.user.id);
            const validItems = [];
            const modalId = `sell_modal_${Date.now()}`;

            const modal = new ModalBuilder()
                .setCustomId(modalId)
                .setTitle(`Sell Items`);

            for (const itemInput of uniqueItems) {
                const itemConfig = EconomyConfig.items[itemInput];
                if (!itemConfig || !itemConfig.sellable) continue;
                
                if (!userData.inventory || !userData.inventory.get(itemInput) || userData.inventory.get(itemInput) < 1) continue;

                validItems.push({ id: itemInput, config: itemConfig });

                const quantityInput = new TextInputBuilder()
                    .setCustomId(`qty_${itemInput}`)
                    .setLabel(`Quantity of ${itemConfig.name}`)
                    .setStyle(TextInputStyle.Short)
                    .setValue('1')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(quantityInput));
            }

            if (validItems.length === 0) {
                return interaction.reply(ComponentUtils.createError(`You do not have any valid or sellable items from that list in your inventory!`));
            }

            await interaction.showModal(modal);

            const submitted = await interaction.awaitModalSubmit({
                time: 60000,
                filter: i => i.user.id === interaction.user.id && i.customId === modalId
            }).catch(() => null);

            if (!submitted) return;
            await submitted.deferReply();

            userData = await EconomyUtils.getUser(interaction.user.id);

            let totalValue = 0;
            let receiptLines = [];
            let successItems = [];

            for (const validItem of validItems) {
                let amountStr = submitted.fields.getTextInputValue(`qty_${validItem.id}`);
                let amount = parseInt(amountStr);
                
                if (isNaN(amount) || amount <= 0) {
                    receiptLines.push(`❌ Invalid quantity for ${validItem.config.name}`);
                    continue;
                }

                if (!userData.inventory || !userData.inventory.get(validItem.id) || userData.inventory.get(validItem.id) < amount) {
                    receiptLines.push(`❌ Failed to sell ${validItem.config.name} (Not enough in inventory)`);
                    continue;
                }

                const basePrice = validItem.config.sellPrice !== undefined ? validItem.config.sellPrice : validItem.config.price;
                const itemTotal = basePrice * amount;
                totalValue += itemTotal;

                await EconomyUtils.removeItem(interaction.user.id, validItem.id, amount);
                successItems.push({ item: validItem, amount, itemTotal });
                receiptLines.push(`> ✅ Sold **${amount.toLocaleString()}x** ${validItem.config.emoji} **${validItem.config.name}** for ${EconomyConfig.currencySymbol}**${itemTotal.toLocaleString()}**`);
            }

            if (totalValue === 0) {
                return submitted.followUp(ComponentUtils.createError(`You did not sell any items successfully.\n\n${receiptLines.join('\n')}`));
            }

            const moneyResult = await EconomyUtils.calculateMoney(totalValue, interaction.user.id);
            const finalValue = moneyResult.finalAmount;

            await EconomyUtils.addCash(interaction.user.id, finalValue, 'wallet');

            const titleDisplay = ComponentUtils.createText(`### 🛒 **${interaction.user.displayName}'s Sale Receipt**`);
            
            let descDisplay;
            if (successItems.length === 1 && receiptLines.length === 1) {
                const sItem = successItems[0];
                descDisplay = ComponentUtils.createText(`${interaction.user} sold **${sItem.amount.toLocaleString()}x** ${sItem.item.config.emoji} **${sItem.item.config.name}** and got paid ${EconomyConfig.currencySymbol}**${finalValue.toLocaleString()}**!`);
            } else {
                descDisplay = ComponentUtils.createText(`${interaction.user} sold their items!\n${receiptLines.join('\n')}\n**Total Received:** ${EconomyConfig.currencySymbol}**${finalValue.toLocaleString()}**`);
            }
            
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
                await interaction.followUp(ComponentUtils.createError('❌ An error occurred while selling the items.')).catch(() => {});
            } else {
                await interaction.reply(ComponentUtils.createError('❌ An error occurred while selling the items.')).catch(() => {});
            }
        }
    }
};
