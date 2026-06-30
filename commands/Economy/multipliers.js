const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder } = require('discord.js');
const EconomySettings = require('../../schemas/EconomySettings.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    owner: true,
    economy: true,
    data: new SlashCommandBuilder()
        .setName('multipliers')
        .setDescription('Set the global economy multipliers.')
        .addNumberOption(option => 
            option.setName('money')
                .setDescription('The global money multiplier (default 1.0)')
                .setRequired(false)
        )
        .addNumberOption(option => 
            option.setName('luck')
                .setDescription('The global luck multiplier (default 1.0)')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('ephemeral')
                .setDescription('Whether the response should be hidden from others (default true)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const isEphemeral = interaction.options.getBoolean('ephemeral') ?? true;
        await interaction.deferReply({ ephemeral: isEphemeral });

        const moneyOpt = interaction.options.getNumber('money');
        const luckOpt = interaction.options.getNumber('luck');

        try {
            let settings = await EconomySettings.findOne({ id: 'global' });
            if (!settings) {
                settings = new EconomySettings();
            }

            if (moneyOpt !== null) settings.moneyMultiplier = moneyOpt;
            if (luckOpt !== null) settings.luckMultiplier = luckOpt;

            await settings.save();

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Global Multipliers Updated')
                .setDescription(`The economy scaling has been adjusted globally.\n\n**Money Multiplier:** x${settings.moneyMultiplier}\n**Luck Multiplier:** x${settings.luckMultiplier}`)
                .setColor(EconomyConfig.successColor);

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Multipliers Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ Failed to update global settings.'));
        }
    }
};
