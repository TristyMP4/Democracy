const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const ComponentUtils = require('../utils/ComponentUtils.js');

module.exports = {
    customID: 'deposit_btn',
    async execute(interaction) {
        // Ensure only the person who ran /balance can use this
        if (interaction.message.interaction && interaction.user.id !== interaction.message.interaction.user.id) {
            return interaction.reply(ComponentUtils.createError(`You cannot use these buttons on someone else's balance!`));
        }

        const modal = new ModalBuilder()
            .setCustomId('deposit_modal')
            .setTitle('Deposit Funds');

        const amountInput = new TextInputBuilder()
            .setCustomId('amount')
            .setLabel("Amount (e.g. 1234, 2k, 50%, max)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(amountInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }
};
