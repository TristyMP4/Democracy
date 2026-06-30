const { EmbedBuilder } = require('discord.js');
const EconomyUser = require('../schemas/EconomyUser.js');
const EconomyConfig = require('../utils/EconomyConfig.js');
const parseAmount = require('../utils/AmountParser.js');

module.exports = {
    data: {
        name: 'deposit_modal'
    },
    async execute(interaction) {
        await interaction.deferUpdate(); 

        const amountInput = interaction.fields.getTextInputValue('amount');

        try {
            let userData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!userData || userData.wallet <= 0) {
                return interaction.followUp({ content: '❌ You do not have any money in your wallet to deposit!', ephemeral: true });
            }

            const amountToDeposit = parseAmount(amountInput, userData.wallet);

            if (amountToDeposit <= 0) {
                return interaction.followUp({ content: '❌ Invalid amount. Please enter a valid number, shorthand (e.g. 2k), or percentage (e.g. 50%).', ephemeral: true });
            }

            if (amountToDeposit > userData.wallet) {
                return interaction.followUp({ content: `❌ You only have **${EconomyConfig.currencySymbol}${userData.wallet.toLocaleString()}** in your wallet!`, ephemeral: true });
            }

            userData.wallet -= amountToDeposit;
            userData.bank += amountToDeposit;

            await userData.save();

            const embed = new EmbedBuilder()
                .setTitle('🏦 Deposit Successful')
                .setDescription(`You deposited **${EconomyConfig.currencySymbol}${amountToDeposit.toLocaleString()}** into your bank.\n\n**New Wallet:** ${EconomyConfig.currencySymbol}${userData.wallet.toLocaleString()}\n**New Bank:** ${EconomyConfig.currencySymbol}${userData.bank.toLocaleString()}`)
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
            console.error('Deposit Modal Error:', error);
            await interaction.followUp({ content: '❌ An error occurred while depositing.', ephemeral: true });
        }
    }
};
