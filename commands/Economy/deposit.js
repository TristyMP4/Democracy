const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder } = require('discord.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const parseAmount = require('../../utils/AmountParser.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit money from your wallet into your bank.')
        .addStringOption(option => 
            option.setName('amount')
                .setDescription('Amount to deposit (e.g. 1234, 2k, 30%, max)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const amountInput = interaction.options.getString('amount');

        try {
            const userData = await EconomyUtils.getUser(interaction.user.id);
            if (userData.wallet <= 0) {
                return interaction.followUp(ComponentUtils.createError('❌ You do not have any money in your wallet to deposit!'));
            }

            const capacity = userData.bankCapacity || 50000;
            const availableSpace = Math.max(0, capacity - userData.bank);

            if (availableSpace <= 0) {
                return interaction.followUp(ComponentUtils.createError('❌ Your bank account is at maximum capacity! Use a **Bank Note** to expand it.'));
            }

            let amountToDeposit = parseAmount(amountInput, userData.wallet);

            if (amountToDeposit <= 0) {
                return interaction.followUp(ComponentUtils.createError('❌ Invalid amount. Please enter a valid number, shorthand (e.g. 2k), or percentage (e.g. 50%).'));
            }

            if (amountToDeposit > userData.wallet) {
                return interaction.followUp(ComponentUtils.createError(`You only have **${EconomyConfig.currencySymbol}${userData.wallet.toLocaleString()}** in your wallet!`));
            }

            if (amountInput.toLowerCase() === 'all' || amountInput.toLowerCase() === 'max') {
                amountToDeposit = Math.min(amountToDeposit, availableSpace);
            } else if (amountToDeposit > availableSpace) {
                return interaction.followUp(ComponentUtils.createError(`❌ Your bank cannot hold that much! You only have space for **${EconomyConfig.currencySymbol}${availableSpace.toLocaleString()}**.`));
            }

            await EconomyUtils.removeCash(interaction.user.id, amountToDeposit, 'wallet');
            await EconomyUtils.addCash(interaction.user.id, amountToDeposit, 'bank');

            // Refetch to get updated balances for display
            const updatedUser = await EconomyUtils.getUser(interaction.user.id);

            const embed = new EmbedBuilder()
                .setTitle('🏦 Deposit Successful')
                .setDescription(`You deposited **${EconomyConfig.currencySymbol}${amountToDeposit.toLocaleString()}** into your bank.\n> **New Wallet:** ${EconomyConfig.currencySymbol}${updatedUser.wallet.toLocaleString()}\n> **New Bank:** ${EconomyConfig.currencySymbol}${updatedUser.bank.toLocaleString()}`)
                .setColor(EconomyConfig.successColor);

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Deposit Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while depositing.'));
        }
    }
};
