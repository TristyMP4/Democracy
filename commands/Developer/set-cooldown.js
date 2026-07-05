const { SlashCommandBuilder } = require('discord.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
const Cooldown = require('../../schemas/cooldown.js');

module.exports = {
    owner: true,
    data: new SlashCommandBuilder()
        .setName('set-cooldown')
        .setDescription('Extend or shorten a user\'s current cooldown.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to modify')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('command')
                .setDescription('Which command cooldown to modify')
                .setRequired(true)
                .addChoices(
                    { name: 'Search', value: 'search' },
                    { name: 'Crime', value: 'crime' },
                    { name: 'Rob', value: 'rob' },
                    { name: 'Work Shift', value: 'shift' },
                    { name: 'Job Application', value: 'work_apply' },
                    { name: 'Bankrob', value: 'bankrob' }
                ))
        .addNumberOption(option =>
            option.setName('minutes')
                .setDescription('Minutes to add (positive) or subtract (negative)')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('ephemeral')
                .setDescription('Should the response be hidden? (Default: True)')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const commandChoice = interaction.options.getString('command');
        const minutes = interaction.options.getNumber('minutes');
        const isEphemeral = interaction.options.getBoolean('ephemeral') ?? true;
        const msChange = minutes * 60 * 1000;

        await interaction.deferReply({ ephemeral: isEphemeral });

        const userData = await EconomyUtils.getUser(targetUser.id);
        let updatedTime = null;
        let foundCooldown = false;

        if (commandChoice === 'search') {
            if (userData.lastSearch) {
                userData.lastSearch = new Date(userData.lastSearch.getTime() + msChange);
                updatedTime = userData.lastSearch;
                foundCooldown = true;
            }
        } else if (commandChoice === 'crime') {
            if (userData.lastCrime) {
                userData.lastCrime = new Date(userData.lastCrime.getTime() + msChange);
                updatedTime = userData.lastCrime;
                foundCooldown = true;
            }
        } else if (commandChoice === 'rob') {
            if (userData.lastRob) {
                userData.lastRob = new Date(userData.lastRob.getTime() + msChange);
                updatedTime = userData.lastRob;
                foundCooldown = true;
            }
        } else if (commandChoice === 'shift') {
            if (userData.lastShift) {
                userData.lastShift = new Date(userData.lastShift.getTime() + msChange);
                updatedTime = userData.lastShift;
                foundCooldown = true;
            }
        } else if (commandChoice === 'work_apply') {
            if (userData.jobApplyCooldown) {
                userData.jobApplyCooldown = new Date(userData.jobApplyCooldown.getTime() + msChange);
                updatedTime = userData.jobApplyCooldown;
                foundCooldown = true;
            }
        } else if (commandChoice === 'bankrob') {
            const existingCooldown = await Cooldown.findOne({ userId: targetUser.id, commandName: 'bankrob' });
            if (existingCooldown && existingCooldown.expiresAt) {
                existingCooldown.expiresAt = new Date(existingCooldown.expiresAt.getTime() + msChange);
                await existingCooldown.save();
                updatedTime = existingCooldown.expiresAt;
                foundCooldown = true;
            }
        }

        if (foundCooldown) {
            await userData.save();
            const { ContainerBuilder } = require('discord.js');
            const container = new ContainerBuilder()
                .setAccentColor(0x2ecc71)
                .addTextDisplayComponents(ComponentUtils.createText(`✅ Successfully modified ${targetUser}'s **${commandChoice}** cooldown.\nAdjusted by **${minutes} minutes**.`));
            return interaction.followUp(ComponentUtils.createContainerResponse(container));
        } else {
            const { ContainerBuilder } = require('discord.js');
            const container = new ContainerBuilder()
                .setAccentColor(0xe74c3c)
                .addTextDisplayComponents(ComponentUtils.createText(`❌ ${targetUser} does not currently have an active cooldown for **${commandChoice}**.`));
            return interaction.followUp(ComponentUtils.createContainerResponse(container));
        }
    }
};
