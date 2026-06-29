const { EmbedBuilder } = require('discord.js');

module.exports = {
    customID: 'changelogModal',
    async execute(interaction, client) {
        // Retrieve the target channel from the cache
        const targetChannelId = client.cache.get(`changelogChannel_${interaction.user.id}`);
        
        if (!targetChannelId) {
            return interaction.reply({
                content: '❌ Could not find the target channel. The session might have expired.',
                ephemeral: true
            });
        }

        const targetChannel = interaction.guild.channels.cache.get(targetChannelId);
        if (!targetChannel) {
            return interaction.reply({
                content: '❌ The target channel no longer exists.',
                ephemeral: true
            });
        }

        const title = interaction.fields.getTextInputValue('changelogTitle');
        const message = interaction.fields.getTextInputValue('changelogMessage');

        const embed = new EmbedBuilder()
            .setTitle(`📢 Bot Update: ${title}`)
            .setDescription(message)
            .setColor(0x2b2d31) // Sleek dark theme
            .setFooter({ text: `Update deployed by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        try {
            await targetChannel.send({ embeds: [embed] });
            
            // Clean up cache
            client.cache.delete(`changelogChannel_${interaction.user.id}`);

            await interaction.reply({
                content: `✅ Changelog successfully posted to ${targetChannel}!`,
                ephemeral: true
            });
        } catch (error) {
            console.error('Changelog Modal Error:', error);
            await interaction.reply({
                content: `❌ Failed to send the changelog. Make sure I have permission to send messages in ${targetChannel}.`,
                ephemeral: true
            });
        }
    }
};
