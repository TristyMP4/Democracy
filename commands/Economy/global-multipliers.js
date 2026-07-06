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
        .addNumberOption(option => 
            option.setName('cooldown')
                .setDescription('The global cooldown multiplier (default 1.0)')
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
        const cooldownOpt = interaction.options.getNumber('cooldown');
        const duration = interaction.options.getInteger('duration');

        try {
            let settings = await EconomySettings.findOne({ id: 'global' });
            if (!settings) {
                settings = new EconomySettings();
            }

            let expiryDate = null;
            if (duration !== null && duration > 0) {
                expiryDate = new Date();
                expiryDate.setMinutes(expiryDate.getMinutes() + duration);
            }

            if (moneyOpt !== null) {
                settings.moneyMultiplier = moneyOpt;
                settings.moneyExpiry = expiryDate;
            }
            if (luckOpt !== null) {
                settings.luckMultiplier = luckOpt;
                settings.luckExpiry = expiryDate;
            }
            if (cooldownOpt !== null) {
                settings.cooldownMultiplier = cooldownOpt;
                settings.cooldownExpiry = expiryDate;
            }

            await settings.save();

            let desc = `The economy scaling has been adjusted globally.\n\n`;
            
            const moneyExpText = settings.moneyExpiry ? ` (Expires: <t:${Math.floor(settings.moneyExpiry.getTime() / 1000)}:R>)` : '';
            desc += `**Money Multiplier:** ${settings.moneyMultiplier}x${moneyExpText}\n`;
            
            const luckExpText = settings.luckExpiry ? ` (Expires: <t:${Math.floor(settings.luckExpiry.getTime() / 1000)}:R>)` : '';
            desc += `**Luck Multiplier:** ${settings.luckMultiplier}x${luckExpText}\n`;
            
            const cdExpText = settings.cooldownExpiry ? ` (Expires: <t:${Math.floor(settings.cooldownExpiry.getTime() / 1000)}:R>)` : '';
            desc += `**Cooldown Multiplier:** ${settings.cooldownMultiplier || 1.0}x${cdExpText}`;

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
