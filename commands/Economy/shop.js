const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Browse and buy items from the global shop.'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Fetch shop items
            const allItems = Object.entries(EconomyConfig.items);
            const shopItems = allItems.filter(([key, item]) => item.shop === true);

            if (shopItems.length === 0) {
                return interaction.followUp(ComponentUtils.createError('The shop is currently empty! Check back later.'));
            }

            let currentPage = 0;
            const itemsPerPage = 6;
            const totalPages = Math.ceil(shopItems.length / itemsPerPage);

            // Initial User fetch for balance display
            let user = await EconomyUtils.getUser(interaction.user.id);

            const generateShopView = (page) => {
                const start = page * itemsPerPage;
                const currentItems = shopItems.slice(start, start + itemsPerPage);

                let description = `### 🛒 Democracy Shop\n*New offerings appear occasionally.*\n> **Balance:** ${EconomyConfig.currencySymbol}${(user.wallet + user.bank).toLocaleString()}\n\n`;

                const row1 = new ActionRowBuilder();
                const row2 = new ActionRowBuilder();

                currentItems.forEach(([key, item], index) => {
                    description += `${item.emoji} **${item.name}**\n`;
                    description += `> ${item.description}\n`;
                    description += `> Price: ${EconomyConfig.currencySymbol}${item.price.toLocaleString()}\n\n`;

                    const buyButton = new ButtonBuilder()
                        .setCustomId(`buy_${key}`)
                        .setLabel(`Buy ${item.name}`)
                        .setEmoji(item.emoji)
                        .setStyle(ButtonStyle.Primary);

                    if (index < 3) row1.addComponents(buyButton);
                    else row2.addComponents(buyButton);
                });

                const embed = new EmbedBuilder()
                    .setDescription(description)
                    .setColor(EconomyConfig.embedColor)
                    .setFooter({ text: `Page ${page + 1} of ${totalPages}` });

                const components = [];
                if (row1.components.length > 0) components.push(row1);
                if (row2.components.length > 0) components.push(row2);

                if (totalPages > 1) {
                    const pageRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('page_prev')
                            .setEmoji(EconomyConfig.BackwardArrow || '◀️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page === 0),
                        new ButtonBuilder()
                            .setCustomId('page_next')
                            .setEmoji(EconomyConfig.ForwardArrow || '▶️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page === totalPages - 1)
                    );
                    components.push(pageRow);
                }

                return { embeds: [embed], components };
            };

            const message = await interaction.followUp(generateShopView(currentPage));

            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply(ComponentUtils.createError('This is not your shop session!'));
                }

                try {
                    if (i.customId === 'page_prev') {
                        currentPage--;
                        await i.update(generateShopView(currentPage));
                    } else if (i.customId === 'page_next') {
                        currentPage++;
                        await i.update(generateShopView(currentPage));
                    } else if (i.customId.startsWith('buy_')) {
                        const itemKey = i.customId.replace('buy_', '');
                        const itemData = EconomyConfig.items[itemKey];

                        // Show Modal
                        const modal = new ModalBuilder()
                            .setCustomId(`modal_buy_${itemKey}`)
                            .setTitle(`Buy ${itemData.name}`);

                        const amountInput = new TextInputBuilder()
                            .setCustomId('quantity')
                            .setLabel('Amount to buy')
                            .setPlaceholder('1')
                            .setValue('1')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                        modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
                        await i.showModal(modal);

                        // Await Modal Submit
                        const modalSubmit = await interaction.awaitModalSubmit({
                            time: 60000,
                            filter: m => m.customId === `modal_buy_${itemKey}` && m.user.id === interaction.user.id
                        }).catch(() => null);

                        if (!modalSubmit) return; // User closed modal or timed out

                        let quantity = parseInt(modalSubmit.fields.getTextInputValue('quantity'));
                        if (isNaN(quantity) || quantity <= 0) {
                            return modalSubmit.reply(ComponentUtils.createError('Please enter a valid number greater than 0.'));
                        }

                        const totalCost = itemData.price * quantity;
                        
                        // Refetch user to get up to date balance
                        user = await EconomyUtils.getUser(interaction.user.id);
                        const totalBalance = user.wallet + user.bank;

                        if (totalBalance < totalCost) {
                            return modalSubmit.reply(ComponentUtils.createError(`You don't have enough money! You need **${EconomyConfig.currencySymbol}${(totalCost - totalBalance).toLocaleString()}** more.`));
                        }

                        // Show Confirmation
                        const confirmEmbed = new EmbedBuilder()
                            .setTitle('Confirm Purchase')
                            .setDescription(`Are you sure you want to buy **${quantity}x ${itemData.name}** for **${EconomyConfig.currencySymbol}${totalCost.toLocaleString()}**?`)
                            .setColor(EconomyConfig.embedColor);

                        const confirmRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('confirm_yes').setLabel('Yes').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('confirm_no').setLabel('No').setStyle(ButtonStyle.Danger)
                        );

                        await modalSubmit.update({ embeds: [confirmEmbed], components: [confirmRow] });

                        // Await Confirmation Button
                        const confirmClick = await message.awaitMessageComponent({
                            componentType: ComponentType.Button,
                            time: 30000,
                            filter: btn => ['confirm_yes', 'confirm_no'].includes(btn.customId) && btn.user.id === interaction.user.id
                        }).catch(() => null);

                        if (!confirmClick) {
                            // User timed out on confirmation
                            await interaction.editReply(generateShopView(currentPage));
                            return;
                        }

                        if (confirmClick.customId === 'confirm_no') {
                            await confirmClick.update(generateShopView(currentPage));
                            return;
                        }

                        // Finalize Purchase
                        // Refetch just in case
                        user = await EconomyUtils.getUser(interaction.user.id);
                        if ((user.wallet + user.bank) < totalCost) {
                            return confirmClick.update(ComponentUtils.createError('You no longer have enough money!'));
                        }

                        const { actualRemoved } = await EconomyUtils.removeCash(interaction.user.id, totalCost, 'cascade');
                        await EconomyUtils.addItem(interaction.user.id, itemKey, quantity);
                        
                        // Refetch one last time to show exact remaining balance
                        user = await EconomyUtils.getUser(interaction.user.id);
                        const remaining = user.wallet + user.bank;

                        const successEmbed = new EmbedBuilder()
                            .setTitle('Successful Purchase')
                            .setDescription(`You have ${EconomyConfig.currencySymbol}${remaining.toLocaleString()} left.\n\n**You bought:**\n- ${quantity} ${itemData.emoji} ${itemData.name}\n\n**You paid:**\n- ${EconomyConfig.currencySymbol}${totalCost.toLocaleString()}`)
                            .setColor(EconomyConfig.successColor);

                        await confirmClick.update({ embeds: [successEmbed], components: [] });
                        collector.stop('bought');
                    }
                } catch (err) {
                    console.error('Shop Interaction Error:', err);
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    // Disable all components on timeout if the shop is still showing
                    const currentView = generateShopView(currentPage);
                    currentView.components.forEach(row => {
                        row.components.forEach(btn => btn.setDisabled(true));
                    });
                    await interaction.editReply({ components: currentView.components }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Shop Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while opening the shop.'));
        }
    }
};
