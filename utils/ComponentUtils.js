const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    /**
     * Creates a simple error response payload using Components V2
     * @param {string} message The error message to display
     * @returns {Object} Payload object ready to be passed to interaction.reply() or interaction.followUp()
     */
    createError: (message) => {
        const cleanMessage = message.startsWith('❌') ? message.replace(/^❌\s*/, '') : message;
        return {
            components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ ${cleanMessage}`))],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        };
    },

    /**
     * Creates a button builder easily
     * @param {Object} options Button options
     * @returns {ButtonBuilder}
     */
    createButton: ({ customId, label, style = ButtonStyle.Primary, emoji, disabled = false }) => {
        const btn = new ButtonBuilder().setCustomId(customId).setStyle(style).setDisabled(disabled);
        if (label) btn.setLabel(label);
        if (emoji) btn.setEmoji(emoji);
        return btn;
    },

    /**
     * Creates a TextDisplayBuilder with the specified content
     * @param {string} content The markdown text to display
     * @returns {TextDisplayBuilder}
     */
    createText: (content) => {
        return new TextDisplayBuilder().setContent(content);
    },

    /**
     * Creates a SeparatorBuilder with a visible divider
     * @param {SeparatorSpacingSize} spacing The spacing size (default: Small)
     * @returns {SeparatorBuilder}
     */
    createSeparator: (spacing = SeparatorSpacingSize.Small) => {
        return new SeparatorBuilder().setDivider(true).setSpacing(spacing);
    },

    /**
     * Creates a standard component response payload
     * @param {ContainerBuilder} container The container to send
     * @returns {Object} Payload object for interaction.reply() or interaction.followUp()
     */
    createContainerResponse: (container) => {
        return {
            flags: MessageFlags.IsComponentsV2,
            components: [container]
        };
    }
};
