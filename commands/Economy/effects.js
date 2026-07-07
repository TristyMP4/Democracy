const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EffectConfigs = require('../../configs/EffectConfigs.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('effects')
        .setDescription('Manage and view economy effects.')
        .addSubcommand(subcommand =>
            subcommand.setName('info')
                .setDescription('View information about a specific effect')
                .addStringOption(option =>
                    option.setName('effect')
                        .setDescription('The effect to check')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('active')
                .setDescription('View active economy effects and multipliers')
                .addUserOption(option => 
                    option.setName('user')
                        .setDescription('The user to check effects for (defaults to yourself)')
                        .setRequired(false)
                )
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const effectKeys = Object.keys(EffectConfigs);
        
        const filtered = effectKeys.filter(key => 
            EffectConfigs[key].name.toLowerCase().includes(focusedValue.toLowerCase())
        );
        
        await interaction.respond(
            filtered.slice(0, 25).map(key => ({ name: EffectConfigs[key].name, value: key }))
        );
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'info') {
                const effectKey = interaction.options.getString('effect');
                const effectConfig = EffectConfigs[effectKey];

                if (!effectConfig) {
                    return interaction.followUp(ComponentUtils.createError('Invalid effect selected.'));
                }

                const embed = new EmbedBuilder()
                    .setTitle(`${effectConfig.emoji} ${effectConfig.name}`)
                    .setDescription(effectConfig.description)
                    .setColor(effectConfig.color || EconomyConfig.embedColor);

                return interaction.followUp({ embeds: [embed] });
            }

            if (subcommand === 'active') {
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
                    const moneyExp = settings.moneyExpiry ? ` (Expires <t:${Math.floor(settings.moneyExpiry.getTime() / 1000)}:R>)` : ` (Permanent)`;
                    globalText += `**Money:** ${settings.moneyMultiplier}x${moneyExp}\n`;
                    hasGlobal = true;
                }
                if (settings.luckMultiplier !== 1.0) {
                    const luckExp = settings.luckExpiry ? ` (Expires <t:${Math.floor(settings.luckExpiry.getTime() / 1000)}:R>)` : ` (Permanent)`;
                    globalText += `**Luck:** ${settings.luckMultiplier}x${luckExp}\n`;
                    hasGlobal = true;
                }
                if (settings.cooldownMultiplier !== 1.0) {
                    const cdExp = settings.cooldownExpiry ? ` (Expires <t:${Math.floor(settings.cooldownExpiry.getTime() / 1000)}:R>)` : ` (Permanent)`;
                    globalText += `**Cooldown:** ${settings.cooldownMultiplier}x${cdExp}\n`;
                    hasGlobal = true;
                }

                if (hasGlobal) {
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

                // --- Personal Status Effects ---
                let statusText = '';
                let hasStatus = false;

                if (userData.effects && userData.effects.length > 0) {
                    const now = new Date();
                    for (const eff of userData.effects) {
                        if (eff.expiry > now) {
                            const effConfig = EffectConfigs[eff.name] || { name: eff.name, emoji: '✨' };
                            statusText += `${effConfig.emoji} **${effConfig.name}** (Expires <t:${Math.floor(eff.expiry.getTime() / 1000)}:R>)\n`;
                            hasStatus = true;
                        }
                    }
                }
                
                if (hasStatus) {
                    embed.addFields({ name: '🎭 Status Effects', value: statusText, inline: false });
                } else {
                    embed.addFields({ name: '🎭 Status Effects', value: '*None active.*', inline: false });
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
                    value: `**Money:** ${totalMoney.toFixed(2)}x\n**Luck:** ${totalLuck.toFixed(2)}x`,
                    inline: false 
                });

                return interaction.followUp({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Effects Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while fetching effects.'));
        }
    }
};
