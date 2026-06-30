const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');

module.exports = {
    customID: 'deposit_btn',
    async execute(interaction) {
        // Ensure only the person who ran /balance can use this
        if (interaction.message.interaction && interaction.user.id !== interaction.message.interaction.user.id) {
            return interaction.reply({ 
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ You cannot use these buttons on someone else's balance!`))],
                flags: MessageFlags.HasComponentsV2,
                ephemeral: true 
            });
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
