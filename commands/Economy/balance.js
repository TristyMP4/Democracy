const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder } = require('discord.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your balance or another user\'s balance.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check the balance of')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;

        if (targetUser.bot) {
            return interaction.followUp(ComponentUtils.createError('Bots do not have economy profiles!'));
        }

        try {
            const userData = await EconomyUtils.getUser(targetUser.id);

            let netWorth = userData.wallet + userData.bank;
            if (userData.inventory) {
                for (const [itemId, quantity] of userData.inventory.entries()) {
                    if (quantity > 0 && EconomyConfig.items[itemId]) {
                        netWorth += EconomyConfig.items[itemId].price * quantity;
                    }
                }
            }

            const titleDisplay = ComponentUtils.createText(`### **${targetUser.displayName}'s Balances**`);
            const rankDisplay = ComponentUtils.createText(`-# Net Worth: **${EconomyConfig.currencySymbol}${netWorth.toLocaleString()}**`);
            const balancesDisplay = ComponentUtils.createText(`${EconomyConfig.currencySymbol}**\`${userData.wallet.toLocaleString()}\` Scrap**\n🏦 **\`${userData.bank.toLocaleString()}\` Scrap**`);

            const isOtherUser = targetUser.id !== interaction.user.id;
            const row = new ActionRowBuilder().addComponents(
                ComponentUtils.createButton({ customId: 'withdraw_btn', label: 'Withdraw', style: ButtonStyle.Secondary, disabled: isOtherUser }),
                ComponentUtils.createButton({ customId: 'deposit_btn', label: 'Deposit', style: ButtonStyle.Secondary, disabled: isOtherUser }),
                ComponentUtils.createButton({ customId: 'refresh_bal_btn', emoji: `${EconomyConfig.RefreshIcon}`, style: ButtonStyle.Secondary, disabled: isOtherUser })
            );

            const container = new ContainerBuilder()
                .addTextDisplayComponents(titleDisplay, rankDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addTextDisplayComponents(balancesDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addActionRowComponents(row);

            await interaction.followUp(ComponentUtils.createContainerResponse(container));

        } catch (error) {
            console.error('Balance Error:', error);
            await interaction.followUp(ComponentUtils.createError(`You don't have a balance yet. Run this command again!`));
        }
    }
};
