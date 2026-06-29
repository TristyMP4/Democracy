const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomySettings = require('../../schemas/EconomySettings.js');

module.exports = {
    owner: true,
    data: new SlashCommandBuilder()
        .setName('disable-economy')
        .setDescription('Globally toggle the economy system on or off.')
        .addBooleanOption(option => 
            option.setName('disabled')
                .setDescription('True to disable the economy, False to enable it')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason shown to users when they try to run an economy command')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const disabled = interaction.options.getBoolean('disabled');
        const reason = interaction.options.getString('reason') || 'Maintenance in progress. Please try again later.';

        try {
            let settings = await EconomySettings.findOne({ id: 'global' });
            if (!settings) {
                settings = new EconomySettings();
            }

            settings.economyDisabled = disabled;
            settings.economyDisabledReason = reason;

            await settings.save();

            const embed = new EmbedBuilder()
                .setTitle(disabled ? '🔒 Economy Disabled' : '🔓 Economy Enabled')
                .setDescription(disabled ? `The global economy is now **locked**.\n\n**Reason:** ${reason}` : 'The global economy has been **unlocked**.')
                .setColor(disabled ? 0xe74c3c : 0x2ecc71);

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Disable Economy Error:', error);
            await interaction.followUp({ content: '❌ Failed to update global settings.' });
        }
    }
};
