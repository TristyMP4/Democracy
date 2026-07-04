const { SlashCommandBuilder } = require('discord.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    owner: true,
    data: new SlashCommandBuilder()
        .setName('modify-modifiers')
        .setDescription('Modify the current multipliers/modifiers of a specific user. (DEV ONLY)')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to modify')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('modifier')
                .setDescription('Which modifier to change')
                .setRequired(true)
                .addChoices(
                    { name: 'Luck Multiplier', value: 'luck' },
                    { name: 'Money Multiplier', value: 'money' },
                    { name: 'Cooldown Multiplier', value: 'cooldown' }
                ))
        .addNumberOption(option =>
            option.setName('value')
                .setDescription('The new multiplier value (e.g. 1.5 for 50% boost, 0.5 for half cooldowns)')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duration in hours for this multiplier (leave blank for permanent)')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('ephemeral')
                .setDescription('Should the response be hidden? (Default: True)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const modifier = interaction.options.getString('modifier');
        const value = interaction.options.getNumber('value');
        const duration = interaction.options.getInteger('duration');
        const isEphemeral = interaction.options.getBoolean('ephemeral') ?? true;

        await interaction.deferReply({ ephemeral: isEphemeral });

        const userData = await EconomyUtils.getUser(targetUser.id);
        
        let expiryDate = null;
        if (duration) {
            expiryDate = new Date(Date.now() + duration * 60 * 60 * 1000);
        }

        let modifierName = '';

        if (modifier === 'luck') {
            userData.luckMultiplier = value;
            userData.luckExpiry = expiryDate;
            modifierName = 'Luck';
        } else if (modifier === 'money') {
            userData.moneyMultiplier = value;
            userData.moneyExpiry = expiryDate;
            modifierName = 'Money';
        } else if (modifier === 'cooldown') {
            userData.cooldownMultiplier = value;
            userData.cooldownExpiry = expiryDate;
            modifierName = 'Cooldown';
        }

        await userData.save();

        let timeStr = expiryDate ? `Expires on <t:${Math.floor(expiryDate.getTime() / 1000)}:f>` : 'Permanent';
        
        const { ContainerBuilder } = require('discord.js');
        const container = new ContainerBuilder()
            .setAccentColor(0x2ecc71)
            .addTextDisplayComponents(ComponentUtils.createText(`✅ Successfully updated ${targetUser}'s **${modifierName} Multiplier** to **${value}x**.\n${timeStr}`));
            
        return interaction.followUp(ComponentUtils.createContainerResponse(container));
    }
};
