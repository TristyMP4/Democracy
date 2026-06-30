const { EmbedBuilder } = require('discord.js');
const EconomyUser = require('../schemas/EconomyUser.js');
const EconomyConfig = require('../utils/EconomyConfig.js');
const parseAmount = require('../utils/AmountParser.js');

module.exports = {
    data: {
        name: 'withdraw_modal'
    },
    async execute(interaction) {
        await interaction.deferUpdate(); // Update the original balance message if possible, or we could deferReply to send a new message.
        // Actually, Modal submits can edit the message directly if we use deferUpdate, then followUp for the alert.

        const amountInput = interaction.fields.getTextInputValue('amount');

        try {
            let userData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!userData || userData.bank <= 0) {
                return interaction.followUp({ content: '❌ You do not have any money in your bank to withdraw!', ephemeral: true });
            }

            const amountToWithdraw = parseAmount(amountInput, userData.bank);

            if (amountToWithdraw <= 0) {
                return interaction.followUp({ content: '❌ Invalid amount. Please enter a valid number, shorthand (e.g. 2k), or percentage (e.g. 50%).', ephemeral: true });
            }

            if (amountToWithdraw > userData.bank) {
                return interaction.followUp({ content: `❌ You only have **${EconomyConfig.currencySymbol}${userData.bank.toLocaleString()}** in your bank!`, ephemeral: true });
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

            const originalEmbed = interaction.message.embeds[0];
            const updatedEmbed = new EmbedBuilder()
                .setTitle(originalEmbed.title)
                .setDescription(`Market Value: **${EconomyConfig.currencySymbol}${netWorth.toLocaleString()}**\n\n🪙 **Wallet:** ${EconomyConfig.currencySymbol}${userData.wallet.toLocaleString()}\n🏦 **Bank:** ${EconomyConfig.currencySymbol}${userData.bank.toLocaleString()}`)
                .setColor(EconomyConfig.embedColor)
                .setThumbnail(originalEmbed.thumbnail.url);

            await interaction.editReply({ embeds: [updatedEmbed] });

        } catch (error) {
            console.error('Withdraw Modal Error:', error);
            await interaction.followUp({ content: '❌ An error occurred while withdrawing.', ephemeral: true });
        }
    }
};
