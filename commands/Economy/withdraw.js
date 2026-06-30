const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomyConfig = require('../../utils/EconomyConfig.js');
const parseAmount = require('../../utils/AmountParser.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw money from your bank into your wallet.')
        .addStringOption(option => 
            option.setName('amount')
                .setDescription('Amount to withdraw (e.g. 1234, 2k, 30%, max)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const amountInput = interaction.options.getString('amount');

        try {
            let userData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!userData || userData.bank <= 0) {
                return interaction.followUp({ content: '❌ You do not have any money in your bank to withdraw!' });
            }

            const amountToWithdraw = parseAmount(amountInput, userData.bank);

            if (amountToWithdraw <= 0) {
                return interaction.followUp({ content: '❌ Invalid amount. Please enter a valid number, shorthand (e.g. 2k), or percentage (e.g. 50%).' });
            }

            if (amountToWithdraw > userData.bank) {
                return interaction.followUp({ content: `❌ You only have **${EconomyConfig.currencySymbol}${userData.bank.toLocaleString()}** in your bank!` });
            }

            userData.bank -= amountToWithdraw;
            userData.wallet += amountToWithdraw;

            await userData.save();

            const embed = new EmbedBuilder()
                .setTitle('🏦 Withdrawal Successful')
                .setDescription(`You withdrew **${EconomyConfig.currencySymbol}${amountToWithdraw.toLocaleString()}** from your bank.\n\n**New Wallet:** ${EconomyConfig.currencySymbol}${userData.wallet.toLocaleString()}\n**New Bank:** ${EconomyConfig.currencySymbol}${userData.bank.toLocaleString()}`)
                .setColor(EconomyConfig.successColor);

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Withdraw Error:', error);
            await interaction.followUp({ content: '❌ An error occurred while withdrawing.' });
        }
    }
};
