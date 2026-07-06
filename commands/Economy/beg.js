const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Beg for money on the streets.'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const user = await EconomyUtils.getUser(interaction.user.id);
            const settings = await EconomyUtils.getSettings();

            // Apply ONLY cooldown multipliers, explicitly ignoring Luck multipliers!
            const globalMultiplier = settings.cooldownMultiplier || 1.0;
            const userMultiplier = user.cooldownMultiplier || 1.0;
            const cooldownTime = (2 * 60 * 1000) * globalMultiplier * userMultiplier; // 2 minutes
            
            if (user.lastBeg && (Date.now() - user.lastBeg.getTime()) < cooldownTime) {
                const remaining = Math.ceil((cooldownTime - (Date.now() - user.lastBeg.getTime())) / 1000);
                return interaction.followUp(ComponentUtils.createError(`You've lost your dignity... Try begging again in **${remaining}s**.`));
            }

            user.lastBeg = new Date();
            await user.save();

            // Raw random chance (60% success rate) - explicitly ignoring EconomyUtils.calculateSuccess
            const roll = Math.random();
            const isSuccess = roll <= 0.60;

            if (isSuccess) {
                // Random payout between 50 and 350 Scrap
                const basePayout = Math.floor(Math.random() * (350 - 50 + 1)) + 50;
                
                // We still apply money multipliers so people don't lose out on global events, 
                // but the *chance* to win was purely raw Math.random!
                const globalMoneyMulti = settings.moneyMultiplier || 1.0;
                const userMoneyMulti = user.moneyMultiplier || 1.0;
                const finalPayout = Math.floor(basePayout * globalMoneyMulti * userMoneyMulti);

                await EconomyUtils.addCash(interaction.user.id, finalPayout);

                const embed = new EmbedBuilder()
                    .setDescription(`🥺 Someone felt bad for you and tossed ${EconomyConfig.currencySymbol}**${finalPayout.toLocaleString()}** into your cup!`)
                    .setColor(EconomyConfig.successColor);

                return interaction.followUp({ embeds: [embed] });
            } else {
                const failMessages = [
                    "Everyone ignored you.",
                    "Someone threw a half-eaten sandwich at you instead.",
                    "A passerby looked at you in disgust.",
                    "You begged for 10 minutes, but nobody gave you anything.",
                    "Someone dropped a coin, but it rolled into a storm drain."
                ];
                const randomMsg = failMessages[Math.floor(Math.random() * failMessages.length)];

                const embed = new EmbedBuilder()
                    .setDescription(`🛑 **${randomMsg}** You received nothing.`)
                    .setColor(EconomyConfig.failColor);

                return interaction.followUp({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Beg Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while trying to beg.'));
        }
    }
};
