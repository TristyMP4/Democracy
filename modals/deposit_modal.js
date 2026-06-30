const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const EconomyUser = require('../schemas/EconomyUser.js');
const EconomyConfig = require('../utils/EconomyConfig.js');
const parseAmount = require('../utils/AmountParser.js');

module.exports = {
    customID: 'deposit_modal',
    async execute(interaction) {
        await interaction.deferUpdate(); 

        const amountInput = interaction.fields.getTextInputValue('amount');

        try {
            let userData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!userData || userData.wallet <= 0) {
                return interaction.followUp({ 
                    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ You do not have any money in your wallet to deposit!`))],
                    flags: MessageFlags.HasComponentsV2,
                    ephemeral: true 
                });
            }

            const amountToDeposit = parseAmount(amountInput, userData.wallet);

            if (amountToDeposit <= 0) {
                return interaction.followUp({ 
                    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ Invalid amount. Please enter a valid number, shorthand (e.g. 2k), or percentage (e.g. 50%).`))],
                    flags: MessageFlags.HasComponentsV2,
                    ephemeral: true 
                });
            }

            if (amountToDeposit > userData.wallet) {
                return interaction.followUp({ 
                    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ You only have **${EconomyConfig.currencySymbol}${userData.wallet.toLocaleString()}** in your wallet!`))],
                    flags: MessageFlags.HasComponentsV2,
                    ephemeral: true 
                });
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

            const titleDisplay = new TextDisplayBuilder().setContent(`### **${interaction.user.username}'s Balances**`);
            const rankDisplay = new TextDisplayBuilder().setContent(`-# Net Worth: **${EconomyConfig.currencySymbol}${netWorth.toLocaleString()}**`);
            const balancesDisplay = new TextDisplayBuilder().setContent(`🪙 **${userData.wallet.toLocaleString()}**\n🏦 **${userData.bank.toLocaleString()}**`);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('withdraw_btn').setLabel('Withdraw').setStyle(ButtonStyle.Secondary).setDisabled(false),
                new ButtonBuilder().setCustomId('deposit_btn').setLabel('Deposit').setStyle(ButtonStyle.Secondary).setDisabled(false),
                new ButtonBuilder().setCustomId('refresh_bal_btn').setEmoji('🔄').setStyle(ButtonStyle.Secondary).setDisabled(false)
            );

            const { SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');

            const container = new ContainerBuilder()
                .addTextDisplayComponents(titleDisplay, rankDisplay)
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
                .addTextDisplayComponents(balancesDisplay)
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
                .addActionRowComponents(row);

            await interaction.editReply({ 
                flags: MessageFlags.IsComponentsV2,
                components: [container] 
            });

        } catch (error) {
            console.error('Deposit Modal Error:', error);
            await interaction.followUp({ 
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ An error occurred while depositing.`))],
                flags: MessageFlags.HasComponentsV2,
                ephemeral: true 
            });
        }
    }
};
