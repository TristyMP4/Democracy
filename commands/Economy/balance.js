const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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

            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

            const embed = new EmbedBuilder()
                .setTitle(`${targetUser.username}'s Balances`)
                .setDescription(`Market Value: **${EconomyConfig.currencySymbol}${netWorth.toLocaleString()}**\n\n🪙 **Wallet:** ${EconomyConfig.currencySymbol}${userData.wallet.toLocaleString()}\n🏦 **Bank:** ${EconomyConfig.currencySymbol}${userData.bank.toLocaleString()}`)
                .setColor(EconomyConfig.embedColor)
                .setThumbnail(targetUser.displayAvatarURL());

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('withdraw_btn').setLabel('Withdraw').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('deposit_btn').setLabel('Deposit').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('refresh_bal_btn').setEmoji('🔄').setStyle(ButtonStyle.Secondary)
            );

            await interaction.followUp({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('Balance Error:', error);
            await interaction.followUp({ content: '❌ An error occurred while checking the balance.' });
        }
    }
};
