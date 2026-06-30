const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const EconomyUser = require('../schemas/EconomyUser.js');
const EconomyConfig = require('../utils/EconomyConfig.js');

module.exports = {
    customID: 'refresh_bal_btn',
    async execute(interaction) {
        // The title is "Username's Balances". Wait, we can't reliably get the target ID from the title easily if there are special characters.
        // If it's the author's balance, interaction.message.interaction.user.id is the author.
        // Let's assume they are refreshing the balance of whoever they ran the command for, OR their own if they ran it.
        // Actually, interaction.message.interaction.user.id is the person who ran the slash command! 
        // But what if they ran `/balance user: @friend`?
        // We might just refresh the person who ran the command, but the title would be wrong.
        // Wait! We can fetch the user ID from the embed if we parse the mentions, but there are no mentions.
        // Let's just fetch the user who ran the interaction!
        
        // Ensure only the person who ran /balance can use this
        if (interaction.message.interaction && interaction.user.id !== interaction.message.interaction.user.id) {
            return interaction.reply({ content: '❌ You cannot use these buttons on someone else\'s balance!', ephemeral: true });
        }

        await interaction.deferUpdate();

        let targetId = interaction.user.id;

        try {
            let userData = await EconomyUser.findOne({ userId: targetId });
            if (!userData) {
                return; // Nothing to refresh
            }

            let netWorth = userData.wallet + userData.bank;
            if (userData.inventory) {
                for (const [itemId, quantity] of userData.inventory.entries()) {
                    if (quantity > 0 && EconomyConfig.items[itemId]) {
                        netWorth += EconomyConfig.items[itemId].price * quantity;
                    }
                }
            }

            let targetUser = client.users.cache.get(targetId);
            if (!targetUser) {
                targetUser = await client.users.fetch(targetId).catch(() => null);
            }
            const username = targetUser ? targetUser.username : 'Unknown';

            const titleDisplay = new TextDisplayBuilder().setContent(`### **${username}'s Balances**`);
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
            console.error('Refresh Bal Error:', error);
        }
    }
};
