const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('changelog')
        .setDescription('Create a formatted changelog message and send it to a specific channel.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the changelog to')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true)
        ),

    async execute(interaction, client) {
        // Owner Check
        if (!client.application.owner) await client.application.fetch();
        const ownerId = client.application.owner.id || client.application.owner.ownerId; 

        if (interaction.user.id !== ownerId) {
            return interaction.reply({
                content: '❌ You must be the application owner to use this command.',
                ephemeral: true
            });
        }

        const channel = interaction.options.getChannel('channel');

        // Store the target channel in the client cache so the modal can access it
        client.cache.set(`changelogChannel_${interaction.user.id}`, channel.id);

        const modal = new ModalBuilder()
            .setCustomId('changelogModal')
            .setTitle('Create Changelog');

        const titleInput = new TextInputBuilder()
            .setCustomId('changelogTitle')
            .setLabel('Update Version / Title')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. v1.2.0 - Security Update')
            .setRequired(true);

        const messageInput = new TextInputBuilder()
            .setCustomId('changelogMessage')
            .setLabel('Changelog Content')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Write your detailed changes here. You can use markdown.')
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(messageInput)
        );

        await interaction.showModal(modal);
    }
};
