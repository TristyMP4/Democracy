const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const parseAmount = require('../../utils/AmountParser.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Give money to another user.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user you want to pay')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('The amount of money to send (e.g. 1234, 2k, 50%, all)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user');
        const amountInput = interaction.options.getString('amount');

        if (targetUser.bot) {
            return interaction.followUp(ComponentUtils.createError('You cannot pay a bot!'));
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.followUp(ComponentUtils.createError('You cannot pay yourself!'));
        }

        try {
            // Find sender
            let senderData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!senderData || senderData.wallet <= 0) {
                return interaction.followUp(ComponentUtils.createError('You do not have any money in your wallet!'));
            }

            const amount = parseAmount(amountInput, senderData.wallet);

            if (amount <= 0) {
                return interaction.followUp(ComponentUtils.createError('Invalid amount. Please enter a valid number, shorthand (e.g. 2k), or percentage (e.g. 50%).'));
            }

            if (senderData.wallet < amount) {
                return interaction.followUp(ComponentUtils.createError(`You only have **${EconomyConfig.currencySymbol}${senderData.wallet.toLocaleString()}** in your wallet!`));
            }

            // Find or create receiver
            let receiverData = await EconomyUser.findOne({ userId: targetUser.id });
            if (!receiverData) {
                receiverData = new EconomyUser({ userId: targetUser.id });
            }

            // Perform transaction
            senderData.wallet -= amount;
            receiverData.wallet += amount;

            await senderData.save();
            await receiverData.save();

            const titleDisplay = ComponentUtils.createText(`### 💸 **Payment Successful**`);
            const descDisplay = ComponentUtils.createText(`You successfully sent **${EconomyConfig.currencySymbol}${amount.toLocaleString()}** to <@${targetUser.id}>!`);
            
            const container = new ContainerBuilder()
                .setAccentColor(EconomyConfig.successColor)
                .addTextDisplayComponents(titleDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addTextDisplayComponents(descDisplay);

            await interaction.followUp(ComponentUtils.createContainerResponse(container));

        } catch (error) {
            console.error('Pay Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred during the transaction.'));
        }
    }
};
