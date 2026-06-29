const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyUser = require('../schemas/EconomyUser.js');
const EconomyConfig = require('../utils/EconomyConfig.js');

module.exports = {
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

            const embed = new EmbedBuilder()
                .setTitle(`💰 ${targetUser.username}'s Balance`)
                .setDescription(`**Wallet:** $${userData.wallet.toLocaleString()}\n**Bank:** $${userData.bank.toLocaleString()}`)
                .setColor(EconomyConfig.embedColor)
                .setThumbnail(targetUser.displayAvatarURL());

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Balance Error:', error);
            await interaction.followUp({ content: '❌ An error occurred while checking the balance.' });
        }
    }
};
