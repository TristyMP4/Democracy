const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomyConfig = require('../../utils/EconomyConfig.js');

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
            return interaction.followUp({ content: 'Bots do not have economy profiles!' });
        }

        try {
            let userData = await EconomyUser.findOne({ userId: targetUser.id });
            
            if (!userData) {
                // If checking someone else who has no data
                if (targetUser.id !== interaction.user.id) {
                    return interaction.followUp({ content: 'That user does not have an economy profile yet.' });
                }
                // If checking self, create profile
                userData = new EconomyUser({ userId: interaction.user.id });
                await userData.save();
            }

            let netWorth = userData.wallet + userData.bank;
            if (userData.inventory) {
                for (const [itemId, quantity] of userData.inventory.entries()) {
                    if (quantity > 0 && EconomyConfig.items[itemId]) {
                        netWorth += EconomyConfig.items[itemId].price * quantity;
                    }
                }
            }

            const section = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${targetUser.username}'s Balances**`));

            const rankDisplay = new TextDisplayBuilder().setContent(`-# Net Worth: **${EconomyConfig.currencySymbol}${netWorth.toLocaleString()}**`);
            const balancesDisplay = new TextDisplayBuilder().setContent(`🪙 **${userData.wallet.toLocaleString()}**\n🏦 **${userData.bank.toLocaleString()}**`);

            const isOtherUser = targetUser.id !== interaction.user.id;
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('withdraw_btn').setLabel('Withdraw').setStyle(ButtonStyle.Secondary).setDisabled(isOtherUser),
                new ButtonBuilder().setCustomId('deposit_btn').setLabel('Deposit').setStyle(ButtonStyle.Secondary).setDisabled(isOtherUser),
                new ButtonBuilder().setCustomId('refresh_bal_btn').setEmoji('🔄').setStyle(ButtonStyle.Secondary).setDisabled(isOtherUser)
            );

            const container = new ContainerBuilder()
                .setAccentColor(EconomyConfig.embedColor)
                .addSectionComponents(section)
                .addTextDisplayComponents(rankDisplay, balancesDisplay)
                .addActionRowComponents(row);

            await interaction.followUp({ 
                flags: MessageFlags.IsComponentsV2,
                components: [container]
            });

        } catch (error) {
            console.error('Balance Error:', error);
            await interaction.followUp({ content: '❌ An error occurred while checking the balance.' });
        }
    }
};
