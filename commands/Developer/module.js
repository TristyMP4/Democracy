const { SlashCommandBuilder, ContainerBuilder } = require('discord.js');
const GlobalSettings = require('../../schemas/GlobalSettings.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    owner: true,
    data: new SlashCommandBuilder()
        .setName('module')
        .setDescription('Globally toggle specific bot modules on or off.')
        .addStringOption(option => 
            option.setName('module')
                .setDescription('The module to toggle')
                .setAutocomplete(true)
                .setRequired(true)
        )
        .addBooleanOption(option => 
            option.setName('disabled')
                .setDescription('True to disable the module, False to enable it')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason shown to users when they try to use the disabled module')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('ephemeral')
                .setDescription('Whether the response should be hidden from others (default true)')
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        const modules = [
            { name: 'Economy Module', value: 'economy' },
            { name: 'Democracy Module', value: 'democracy' },
            { name: 'All Modules', value: 'all' }
        ];

        const filtered = modules.filter(choice => 
            choice.name.toLowerCase().includes(focusedValue) || choice.value.includes(focusedValue)
        );

        await interaction.respond(filtered);
    },

    async execute(interaction) {
        const isEphemeral = interaction.options.getBoolean('ephemeral') ?? true;
        await interaction.deferReply({ ephemeral: isEphemeral });

        const targetModule = interaction.options.getString('module');
        const disabled = interaction.options.getBoolean('disabled');
        const reason = interaction.options.getString('reason') || 'Maintenance in progress. Please try again later.';

        // Ensure they picked a valid autocomplete option just in case
        if (!['economy', 'democracy', 'all'].includes(targetModule)) {
            return interaction.followUp(ComponentUtils.createError('Invalid module selected. Please use the autocomplete options.'));
        }

        try {
            let settings = await GlobalSettings.findOne({ id: 'global' });
            if (!settings) {
                settings = new GlobalSettings();
            }

            let affectedSystems = [];

            if (targetModule === 'economy' || targetModule === 'all') {
                settings.economyDisabled = disabled;
                settings.economyDisabledReason = reason;
                affectedSystems.push('Economy');
            }

            if (targetModule === 'democracy' || targetModule === 'all') {
                settings.democracyDisabled = disabled;
                settings.democracyDisabledReason = reason;
                affectedSystems.push('Democracy');
            }

            await settings.save();

            const titleStr = disabled ? '🔒 **Modules Locked**' : '🔓 **Modules Unlocked**';
            const actionStr = disabled ? 'disabled' : 'enabled';
            
            let descStr = `The following systems have been **${actionStr}**:\n`;
            affectedSystems.forEach(sys => {
                descStr += `> • ${sys}\n`;
            });

            if (disabled) {
                descStr += `\n**Reason:** \`${reason}\``;
            }

            const titleDisplay = ComponentUtils.createText(`### ${titleStr}`);
            const descDisplay = ComponentUtils.createText(descStr);

            const container = new ContainerBuilder()
                .setAccentColor(disabled ? 0xe74c3c : 0x2ecc71)
                .addTextDisplayComponents(titleDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addTextDisplayComponents(descDisplay);

            await interaction.followUp(ComponentUtils.createContainerResponse(container));

        } catch (error) {
            console.error('Module Toggle Error:', error);
            await interaction.followUp(ComponentUtils.createError('Failed to update global module settings.'));
        }
    }
};
