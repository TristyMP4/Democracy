const { SlashCommandBuilder, ActionRowBuilder, ButtonStyle, ComponentType, ContainerBuilder } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Check your items.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check the inventory of')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;

        if (targetUser.bot) {
            return interaction.followUp(ComponentUtils.createError('❌ Bots do not have inventories!'));
        }

        try {
            const userData = await EconomyUser.findOne({ userId: targetUser.id });
            
            if (!userData || !userData.inventory || userData.inventory.size === 0) {
                const emptyContainer = new ContainerBuilder()
                    .addTextDisplayComponents(ComponentUtils.createText(`### **${targetUser.displayName}'s Inventory**\n-# This inventory is completely empty.`));
                return interaction.followUp(ComponentUtils.createContainerResponse(emptyContainer));
            }

            let itemsArray = [];
            let totalMarketValue = 0;

            for (const [itemId, quantity] of userData.inventory.entries()) {
                if (quantity > 0) {
                    const itemConfig = EconomyConfig.items[itemId];
                    if (itemConfig) {
                        const totalValue = itemConfig.price * quantity;
                        totalMarketValue += totalValue;
                        itemsArray.push({
                            id: itemId,
                            name: itemConfig.name,
                            emoji: itemConfig.emoji,
                            quantity: quantity,
                            totalValue: totalValue,
                            price: itemConfig.price
                        });
                    }
                }
            }

            // Sort alphabetically by name
            itemsArray.sort((a, b) => a.name.localeCompare(b.name));

            if (itemsArray.length === 0) {
                const emptyContainer = new ContainerBuilder()
                    .addTextDisplayComponents(ComponentUtils.createText(`### **${targetUser.displayName}'s Inventory**\n-# This inventory is completely empty.`));
                return interaction.followUp(ComponentUtils.createContainerResponse(emptyContainer));
            }

            const itemsPerPage = 6;
            const totalPages = Math.ceil(itemsArray.length / itemsPerPage);
            let currentPage = 0;

            const generateContainer = (page, disabled = false) => {
                const start = page * itemsPerPage;
                const end = start + itemsPerPage;
                const pageItems = itemsArray.slice(start, end);

                let pageMarketValue = 0;
                let itemsText = '';

                for (const item of pageItems) {
                    pageMarketValue += item.totalValue;
                    itemsText += `${item.emoji} **${item.name}** — ${item.quantity.toLocaleString()}\n${EconomyConfig.ReplyIcon} *Value: ${EconomyConfig.currencySymbol}${item.totalValue.toLocaleString()}*\n\n`;
                }

                const titleText = `### **${targetUser.displayName}'s Inventory**\n-# Total Market Value: ${EconomyConfig.currencySymbol}${totalMarketValue.toLocaleString()}\n-# Page Market Value: ${EconomyConfig.currencySymbol}${pageMarketValue.toLocaleString()}`;
                const pageText = `-# Page ${page + 1} of ${totalPages}`;

                const row = new ActionRowBuilder().addComponents(
                    ComponentUtils.createButton({ customId: `inv_first`, emoji: `${EconomyConfig.StartArrow}`, style: ButtonStyle.Secondary, disabled: disabled || page === 0 }),
                    ComponentUtils.createButton({ customId: `inv_prev`, emoji: `${EconomyConfig.BackwardArrow}`, style: ButtonStyle.Secondary, disabled: disabled || page === 0 }),
                    ComponentUtils.createButton({ customId: `inv_refresh`, emoji: `${EconomyConfig.RefreshIcon}`, style: ButtonStyle.Secondary, disabled: disabled }),
                    ComponentUtils.createButton({ customId: `inv_next`, emoji: `${EconomyConfig.ForwardArrow}`, style: ButtonStyle.Secondary, disabled: disabled || page === totalPages - 1 }),
                    ComponentUtils.createButton({ customId: `inv_last`, emoji: `${EconomyConfig.LastArrow}`, style: ButtonStyle.Secondary, disabled: disabled || page === totalPages - 1 })
                );

                return new ContainerBuilder()
                    .addTextDisplayComponents(ComponentUtils.createText(titleText))
                    .addSeparatorComponents(ComponentUtils.createSeparator())
                    .addTextDisplayComponents(ComponentUtils.createText(itemsText.trim()))
                    .addSeparatorComponents(ComponentUtils.createSeparator())
                    .addTextDisplayComponents(ComponentUtils.createText(pageText))
                    .addActionRowComponents(row);
            };

            const response = await interaction.followUp(ComponentUtils.createContainerResponse(generateContainer(currentPage)));

            // If there's only 1 page, don't even start a collector to save resources
            if (totalPages <= 1) return;

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply(ComponentUtils.createError('❌ You cannot use these buttons!'));
                }

                if (i.customId === 'inv_first') {
                    currentPage = 0;
                } else if (i.customId === 'inv_prev') {
                    currentPage = Math.max(0, currentPage - 1);
                } else if (i.customId === 'inv_next') {
                    currentPage = Math.min(totalPages - 1, currentPage + 1);
                } else if (i.customId === 'inv_last') {
                    currentPage = totalPages - 1;
                }

                // Reset timer
                collector.resetTimer();

                await i.update(ComponentUtils.createContainerResponse(generateContainer(currentPage)));
            });

            collector.on('end', async () => {
                await interaction.editReply(ComponentUtils.createContainerResponse(generateContainer(currentPage, true))).catch(() => {});
            });

        } catch (error) {
            console.error('Inventory Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while checking the inventory.'));
        }
    }
};
