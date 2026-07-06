const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder } = require('discord.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const parseAmount = require('../../utils/AmountParser.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

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
            const userData = await EconomyUtils.getUser(interaction.user.id);

            // Block withdraw if currently being bankrobbed
            if (userData.activeBankrobExpiry && userData.activeBankrobExpiry > new Date()) {
                const remaining = Math.ceil((userData.activeBankrobExpiry.getTime() - Date.now()) / 1000);
                return interaction.followUp(ComponentUtils.createError(`🚨 **LOCKDOWN!** 🚨\nYour bank is currently under attack by a heist crew! You cannot withdraw money for the next **${remaining}s**!`));
            }

            if (userData.bank <= 0) {
                return interaction.followUp(ComponentUtils.createError('❌ You do not have any money in your bank to withdraw!'));
            }

            const amountToWithdraw = parseAmount(amountInput, userData.bank);

            if (amountToWithdraw <= 0) {
                return interaction.followUp(ComponentUtils.createError('❌ Invalid amount. Please enter a valid number, shorthand (e.g. 2k), or percentage (e.g. 50%).'));
            }

            if (amountToWithdraw > userData.bank) {
                return interaction.followUp(ComponentUtils.createError(`You only have **${EconomyConfig.currencySymbol}${userData.bank.toLocaleString()}** in your bank!`));
            }

            await EconomyUtils.removeCash(interaction.user.id, amountToWithdraw, 'bank');
            await EconomyUtils.addCash(interaction.user.id, amountToWithdraw, 'wallet');

            const updatedUser = await EconomyUtils.getUser(interaction.user.id);

            const embed = new EmbedBuilder()
                .setTitle('🏦 Withdrawal Successful')
                .setDescription(`You withdrew **${EconomyConfig.currencySymbol}${amountToWithdraw.toLocaleString()}** from your bank.\n> **New Wallet:** ${EconomyConfig.currencySymbol}${updatedUser.wallet.toLocaleString()}\n> **New Bank:** ${EconomyConfig.currencySymbol}${updatedUser.bank.toLocaleString()}`)
                .setColor(EconomyConfig.successColor);

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Withdraw Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while withdrawing.'));
        }
    }
};
