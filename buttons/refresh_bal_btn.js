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

        // Get the title string to preserve it
        const originalEmbed = interaction.message.embeds[0];
        const title = originalEmbed.title; // "Username's Balances"
        const thumbnail = originalEmbed.thumbnail ? originalEmbed.thumbnail.url : interaction.user.displayAvatarURL();

        // But whose balance was it? If they ran `/balance user:friend`, we don't know the friend's ID easily.
        // Wait, we can just extract the ID from the embed's thumbnail URL? Or just assume it's the executor.
        // Actually, if we just extract the name, we don't have the user object.
        // But we DO have the target user's ID if we look at the interaction.message.interaction... wait, the options are lost.
        // Let's just fetch the author's economy! If they ran it on someone else, refreshing might show their own or crash.
        // Let's just check the user who clicked it for now to avoid complexity, or extract from thumbnail.
        // Thumbnail URL usually has the user ID: https://cdn.discordapp.com/avatars/USERID/hash.png
        
        let targetId = interaction.user.id;
        const urlMatch = thumbnail.match(/avatars\/(\d+)\//);
        if (urlMatch) {
            targetId = urlMatch[1];
        }

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

            const section = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title.replace("'s Balances", "")}'s Balances**`))
                .setButtonAccessory(new ButtonBuilder().setCustomId('net_worth_dummy').setLabel('Net Worth').setStyle(ButtonStyle.Secondary).setDisabled(true));

            const rankDisplay = new TextDisplayBuilder().setContent(`Market Value: **${EconomyConfig.currencySymbol}${netWorth.toLocaleString()}**`);
            const balancesDisplay = new TextDisplayBuilder().setContent(`🪙 **${userData.wallet.toLocaleString()}**\n🏦 **${userData.bank.toLocaleString()}**`);

            const container = new ContainerBuilder()
                .setAccentColor(EconomyConfig.embedColor)
                .addSectionComponents(section)
                .addTextDisplayComponents(rankDisplay, balancesDisplay);

            await interaction.editReply({ 
                flags: MessageFlags.IsComponentsV2,
                components: [container, interaction.message.components[1]] 
            });

        } catch (error) {
            console.error('Refresh Bal Error:', error);
        }
    }
};
