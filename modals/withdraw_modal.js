const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, EmbedBuilder } = require('discord.js');
const ComponentUtils = require('../utils/ComponentUtils.js');
const EconomyUser = require('../schemas/EconomyUser.js');
const EconomyConfig = require('../configs/EconomyConfig.js');
const parseAmount = require('../utils/AmountParser.js');

module.exports = {
    customID: 'withdraw_modal',
    async execute(interaction) {
        await interaction.deferUpdate(); // Update the original balance message if possible, or we could deferReply to send a new message.
        // Actually, Modal submits can edit the message directly if we use deferUpdate, then followUp for the alert.

        const amountInput = interaction.fields.getTextInputValue('amount');

        try {
            let userData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!userData || userData.bank <= 0) {
                return interaction.followUp(ComponentUtils.createError('❌ You do not have any money in your bank to withdraw!'));
            }

            const amountToWithdraw = parseAmount(amountInput, userData.bank);

            if (amountToWithdraw <= 0) {
                return interaction.followUp(ComponentUtils.createError('❌ Invalid amount. Please enter a valid number, shorthand (e.g. 2k), or percentage (e.g. 50%).'));
            }

            if (amountToWithdraw > userData.bank) {
                return interaction.followUp(ComponentUtils.createError(`❌ You only have **${EconomyConfig.currencySymbol}${userData.bank.toLocaleString()}** in your bank!`));
            }

            userData.bank -= amountToWithdraw;
            userData.wallet += amountToWithdraw;

            await userData.save();

            const embed = new EmbedBuilder()
                .setTitle('🏦 Withdrawal Successful')
                .setDescription(`You withdrew **${EconomyConfig.currencySymbol}${amountToWithdraw.toLocaleString()}** from your bank.\n\n**New Wallet:** ${EconomyConfig.currencySymbol}${userData.wallet.toLocaleString()}\n**New Bank:** ${EconomyConfig.currencySymbol}${userData.bank.toLocaleString()}`)
                .setColor(EconomyConfig.successColor);

            await interaction.followUp({ embeds: [embed], ephemeral: true });

            // Now automatically refresh the balance embed!
            let netWorth = userData.wallet + userData.bank;
            if (userData.inventory) {
                for (const [itemId, quantity] of userData.inventory.entries()) {
                    if (quantity > 0 && EconomyConfig.items[itemId]) {
                        netWorth += EconomyConfig.items[itemId].price * quantity;
                    }
                }
            }

            const titleDisplay = ComponentUtils.createText(`### **${interaction.user.username}'s Balances**`);
            const rankDisplay = ComponentUtils.createText(`-# Net Worth: **${EconomyConfig.currencySymbol}${netWorth.toLocaleString()}**`);
            const balancesDisplay = ComponentUtils.createText(`🪙 **${userData.wallet.toLocaleString()}**\n🏦 **${userData.bank.toLocaleString()}**`);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('withdraw_btn').setLabel('Withdraw').setStyle(ButtonStyle.Secondary).setDisabled(false),
                new ButtonBuilder().setCustomId('deposit_btn').setLabel('Deposit').setStyle(ButtonStyle.Secondary).setDisabled(false),
                new ButtonBuilder().setCustomId('refresh_bal_btn').setEmoji('🔄').setStyle(ButtonStyle.Secondary).setDisabled(false)
            );

            const container = new ContainerBuilder()
                .addTextDisplayComponents(titleDisplay, rankDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addTextDisplayComponents(balancesDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addActionRowComponents(row);

            await interaction.editReply(ComponentUtils.createContainerResponse(container));

        } catch (error) {
            console.error('Withdraw Modal Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while withdrawing.'));
        }
    }
};
