const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder } = require('discord.js');
const EconomySettings = require('../../schemas/EconomySettings.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    owner: true,
    economy: true,
    data: new SlashCommandBuilder()
        .setName('global-multipliers')
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
        .addIntegerOption(option => 
            option.setName('duration')
                .setDescription('Duration in minutes (leave blank for permanent)')
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
        const duration = interaction.options.getInteger('duration');

        try {
            let settings = await EconomySettings.findOne({ id: 'global' });
            if (!settings) {
                settings = new EconomySettings();
            }

            if (moneyOpt !== null) settings.moneyMultiplier = moneyOpt;
            if (luckOpt !== null) settings.luckMultiplier = luckOpt;
            
            if (duration !== null && duration > 0) {
                const expiry = new Date();
                expiry.setMinutes(expiry.getMinutes() + duration);
                settings.multiplierExpiry = expiry;
            } else {
                settings.multiplierExpiry = null;
            }

            await settings.save();

            let desc = `The economy scaling has been adjusted globally.\n\n**Money Multiplier:** x${settings.moneyMultiplier}\n**Luck Multiplier:** x${settings.luckMultiplier}`;
            if (settings.multiplierExpiry) {
                desc += `\n**Expires:** <t:${Math.floor(settings.multiplierExpiry.getTime() / 1000)}:R>`;
            } else {
                desc += `\n**Expires:** Never (Permanent)`;
            }

            const embed = new EmbedBuilder()
                .setTitle('⚖️ Global Multipliers Updated')
                .setDescription(desc)
                .setColor(EconomyConfig.successColor);

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Multipliers Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ Failed to update global settings.'));
        }
    }
};
