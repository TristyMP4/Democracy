const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder } = require('discord.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
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
            let senderData = await EconomyUtils.getUser(interaction.user.id);
            if (senderData.wallet <= 0) {
                return interaction.followUp(ComponentUtils.createError('You do not have any money in your wallet!'));
            }

            const amount = parseAmount(amountInput, senderData.wallet);

            if (amount <= 0) {
                return interaction.followUp(ComponentUtils.createError('Invalid amount. Please enter a valid number, shorthand (e.g. 2k), or percentage (e.g. 50%).'));
            }

            if (senderData.wallet < amount) {
                return interaction.followUp(ComponentUtils.createError(`You only have **${EconomyConfig.currencySymbol}${senderData.wallet.toLocaleString()}** in your wallet!`));
            }

            // Perform transaction
            await EconomyUtils.removeCash(interaction.user.id, amount, 'wallet');
            await EconomyUtils.addCash(targetUser.id, amount, 'bank');

            // Attempt to DM the target user
            const dmEmbed = new EmbedBuilder()
                .setTitle('💸 Payment Received')
                .setDescription(`**${interaction.user.username}** has sent you **${EconomyConfig.currencySymbol}${amount.toLocaleString()}**!\n\nThe money has been deposited directly into your bank.`)
                .setColor(EconomyConfig.successColor);
            await EconomyUtils.dmUser(targetUser, { embeds: [dmEmbed] });

            const titleDisplay = ComponentUtils.createText(`### 💸 **Payment Successful**`);
            const descDisplay = ComponentUtils.createText(`You successfully sent **${EconomyConfig.currencySymbol}${amount.toLocaleString()}** to <@${targetUser.id}>!\n*(It was deposited directly into their bank account)*`);
            
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
