const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('effects')
        .setDescription('View active economy effects and multipliers.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check effects for (defaults to yourself)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;

            if (targetUser.bot) {
                return interaction.followUp(ComponentUtils.createError('Bots do not have economy profiles!'));
            }

            // Fetching automatically clears expired effects
            const userData = await EconomyUtils.getUser(targetUser.id);
            const settings = await EconomyUtils.getSettings();

            const embed = new EmbedBuilder()
                .setTitle(`✨ Active Effects: ${targetUser.username}`)
                .setColor(EconomyConfig.embedColor)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }));

            // --- Global Effects ---
            let globalText = '';
            let hasGlobal = false;
            
            if (settings.moneyMultiplier !== 1.0) {
                globalText += `**Money:** x${settings.moneyMultiplier}\n`;
                hasGlobal = true;
            }
            if (settings.luckMultiplier !== 1.0) {
                globalText += `**Luck:** x${settings.luckMultiplier}\n`;
                hasGlobal = true;
            }
            if (settings.cooldownMultiplier !== 1.0) {
                globalText += `**Cooldown:** x${settings.cooldownMultiplier}\n`;
                hasGlobal = true;
            }

            if (hasGlobal) {
                if (settings.multiplierExpiry) {
                    globalText += `*Expires: <t:${Math.floor(settings.multiplierExpiry.getTime() / 1000)}:R>*`;
                } else {
                    globalText += `*Expires: Never (Permanent)*`;
                }
                embed.addFields({ name: '🌍 Global Multipliers', value: globalText, inline: false });
            } else {
                embed.addFields({ name: '🌍 Global Multipliers', value: '*None active.*', inline: false });
            }

            // --- Personal Effects ---
            let personalText = '';
            let hasPersonal = false;

            if (userData.moneyMultiplier !== 1.0) {
                const prefix = userData.moneyMultiplier > 1.0 ? '+' : '';
                const formatMulti = `${prefix}${(userData.moneyMultiplier - 1.0).toFixed(1)}x`;
                personalText += `**Money:** ${formatMulti} `;
                if (userData.moneyExpiry) {
                    personalText += `(Expires <t:${Math.floor(userData.moneyExpiry.getTime() / 1000)}:R>)\n`;
                } else {
                    personalText += `(Permanent)\n`;
                }
                hasPersonal = true;
            }

            if (userData.luckMultiplier !== 1.0) {
                const prefix = userData.luckMultiplier > 1.0 ? '+' : '';
                const formatMulti = `${prefix}${(userData.luckMultiplier - 1.0).toFixed(1)}x`;
                personalText += `**Luck:** ${formatMulti} `;
                if (userData.luckExpiry) {
                    personalText += `(Expires <t:${Math.floor(userData.luckExpiry.getTime() / 1000)}:R>)\n`;
                } else {
                    personalText += `(Permanent)\n`;
                }
                hasPersonal = true;
            }

            if (userData.cooldownMultiplier && userData.cooldownMultiplier !== 1.0) {
                const prefix = userData.cooldownMultiplier > 1.0 ? '+' : '';
                const formatMulti = `${prefix}${(userData.cooldownMultiplier - 1.0).toFixed(1)}x`;
                personalText += `**Cooldown:** ${formatMulti} `;
                if (userData.cooldownExpiry) {
                    personalText += `(Expires <t:${Math.floor(userData.cooldownExpiry.getTime() / 1000)}:R>)\n`;
                } else {
                    personalText += `(Permanent)\n`;
                }
                hasPersonal = true;
            }

            if (hasPersonal) {
                embed.addFields({ name: '👤 Personal Multipliers', value: personalText, inline: false });
            } else {
                embed.addFields({ name: '👤 Personal Multipliers', value: '*None active.*', inline: false });
            }

            // Calculate Totals
            const totalMoney = Math.max(0, (settings.moneyMultiplier || 1.0) + ((userData.moneyMultiplier || 1.0) - 1.0));
            
            let rawLuckMulti = (settings.luckMultiplier || 1.0) + ((userData.luckMultiplier || 1.0) - 1.0);
            let totalLuck;
            if (rawLuckMulti >= 0.05) {
                totalLuck = rawLuckMulti;
            } else {
                totalLuck = 0.05 * Math.exp(rawLuckMulti - 0.05);
            }
            
            embed.addFields({ 
                name: '📊 Total Effective Rates', 
                value: `**Money:** x${totalMoney.toFixed(2)}\n**Luck:** x${totalLuck.toFixed(2)}`,
                inline: false 
            });

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Effects Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while fetching effects.'));
        }
    }
};
