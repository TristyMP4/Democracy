const { SlashCommandBuilder, ContainerBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to steal cash from another user.')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The user you want to rob')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('target');

            if (targetUser.bot) {
                return interaction.followUp(ComponentUtils.createError('You cannot rob a bot. They have no use for human currency.'));
            }

            if (targetUser.id === interaction.user.id) {
                return interaction.followUp(ComponentUtils.createError('You cannot rob yourself.'));
            }

            let attackerData = await EconomyUtils.getUser(interaction.user.id);

            if (attackerData.wallet < EconomyConfig.rob.minimumAmountToRob) {
                return interaction.followUp(ComponentUtils.createError(`You need at least **${EconomyConfig.currencySymbol}${EconomyConfig.rob.minimumAmountToRob}** in your wallet to attempt a robbery.`));
            }

            // Cooldown check
            const settings = await EconomyUtils.getSettings();
            const globalMultiplier = settings.cooldownMultiplier || 1.0;
            const userMultiplier = attackerData.cooldownMultiplier || 1.0;
            const cooldownTime = EconomyConfig.rob.cooldown * globalMultiplier * userMultiplier;
            if (attackerData.lastRob && (Date.now() - attackerData.lastRob.getTime()) < cooldownTime) {
                const remaining = Math.ceil((cooldownTime - (Date.now() - attackerData.lastRob.getTime())) / 1000);
                return interaction.followUp(ComponentUtils.createError(`You're bringing too much attention to yourself! Wait **${remaining}s** before robbing again.`));
            }

            let targetData = await EconomyUtils.getUser(targetUser.id);
            if (targetData.wallet <= 0) {
                return interaction.followUp(ComponentUtils.createError(`**${targetUser.username}**'s wallet is completely empty. There's nothing to steal.`));
            }

            // Update cooldown
            attackerData.lastRob = new Date();
            await attackerData.save(); // Save the cooldown

            const robConfig = EconomyConfig.rob;
            const rollResult = await EconomyUtils.calculateLuckRoll(robConfig.successChance);

            if (rollResult.isSuccess) {
                // Calculate steal amount based on target's wallet
                const stealMin = targetData.wallet * robConfig.minStealPercentage;
                const stealMax = targetData.wallet * robConfig.maxStealPercentage;
                
                let stealAmount = Math.round(Math.random() * (stealMax - stealMin) + stealMin);
                if (stealAmount < 1) stealAmount = 1; // Always steal at least 1 if successful and they have money
                if (stealAmount > targetData.wallet) stealAmount = targetData.wallet;

                // Transfer funds
                await EconomyUtils.removeCash(targetUser.id, stealAmount, 'wallet');
                await EconomyUtils.addCash(interaction.user.id, stealAmount, 'wallet');

                const titleDisplay = ComponentUtils.createText(`### 🥷 **Heist Successful**`);
                const descDisplay = ComponentUtils.createText(`You slipped into **${targetUser}**'s pockets and managed to steal **${EconomyConfig.currencySymbol}${stealAmount.toLocaleString()}** without them noticing!`);
                
                const container = new ContainerBuilder()
                    .setAccentColor(EconomyConfig.successColor)
                    .addTextDisplayComponents(titleDisplay)
                    .addSeparatorComponents(ComponentUtils.createSeparator())
                    .addTextDisplayComponents(descDisplay);

                return interaction.followUp(ComponentUtils.createContainerResponse(container));

            } else {
                // Refetch to prevent desync during fine calculation
                attackerData = await EconomyUtils.getUser(interaction.user.id);

                // Failed - Calculate fine (based on total wealth to prevent stashing loopholes)
                let fine = Math.floor((attackerData.wallet + attackerData.bank) * robConfig.finePercentage);
                if (fine < 100) fine = 100; // Minimum fine
                
                const { actualRemoved } = await EconomyUtils.removeCash(interaction.user.id, fine, 'cascade');

                const titleDisplay = ComponentUtils.createText(`### 🚓 **Busted!**`);
                const descDisplay = ComponentUtils.createText(`**${targetUser}** caught you trying to reach into their wallet!\n\nYou were forced to pay a fine of **${EconomyConfig.currencySymbol}${actualRemoved.toLocaleString()}** to avoid the cops.`);
                
                const container = new ContainerBuilder()
                    .setAccentColor(EconomyConfig.failColor)
                    .addTextDisplayComponents(titleDisplay)
                    .addSeparatorComponents(ComponentUtils.createSeparator())
                    .addTextDisplayComponents(descDisplay);

                return interaction.followUp(ComponentUtils.createContainerResponse(container));
            }

        } catch (error) {
            console.error('Rob Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while attempting to rob.'));
        }
    }
};
