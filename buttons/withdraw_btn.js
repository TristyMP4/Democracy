const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    customID: 'withdraw_btn',
    async execute(interaction) {
        // Ensure only the person who ran /balance can use this
        if (interaction.message.interaction && interaction.user.id !== interaction.message.interaction.user.id) {
            return interaction.reply({ content: '❌ You cannot use these buttons on someone else\'s balance!', ephemeral: true });
        }

        const modal = new ModalBuilder()
            .setCustomId('withdraw_modal')
            .setTitle('Withdraw Funds');

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
