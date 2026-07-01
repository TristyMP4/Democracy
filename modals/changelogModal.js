const { ContainerBuilder } = require('discord.js');
const ComponentUtils = require('../utils/ComponentUtils.js');

module.exports = {
    customID: 'changelogModal',
    async execute(interaction, client) {
        const targetChannelId = client.cache.get(`changelogChannel_${interaction.user.id}`);
        
        if (!targetChannelId) {
            return interaction.reply(ComponentUtils.createError('Could not find the target channel. The session might have expired.'));
        }

        const targetChannel = interaction.guild.channels.cache.get(targetChannelId);
        if (!targetChannel) {
            return interaction.reply(ComponentUtils.createError('The target channel no longer exists.'));
        }

        const title = interaction.fields.getTextInputValue('changelogTitle');
        const message = interaction.fields.getTextInputValue('changelogMessage');

        const titleDisplay = ComponentUtils.createText(`### 📢 **Bot Update: ${title}**`);
        const messageDisplay = ComponentUtils.createText(message);
        const footerDisplay = ComponentUtils.createText(`-# Update deployed by ${interaction.user.username}`);

        const container = new ContainerBuilder()
            .setAccentColor(0x2b2d31)
            .addTextDisplayComponents(titleDisplay)
            .addSeparatorComponents(ComponentUtils.createSeparator())
            .addTextDisplayComponents(messageDisplay)
            .addSeparatorComponents(ComponentUtils.createSeparator())
            .addTextDisplayComponents(footerDisplay);

        try {
            const payload = ComponentUtils.createContainerResponse(container);
            payload.content = '@everyone';
            
            await targetChannel.send(payload);
            
            // Clean up cache
            client.cache.delete(`changelogChannel_${interaction.user.id}`);

            await interaction.reply({
                content: `✅ Changelog successfully posted to ${targetChannel}!`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Changelog Modal Error:', error);
            await interaction.reply(ComponentUtils.createError(`Failed to send the changelog. Make sure I have permission to send messages in ${targetChannel}.`));
        }
    }
};
