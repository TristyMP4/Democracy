const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
const Cooldown = require('../../schemas/cooldown.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('pick-pocket')
        .setDescription('Try to steal a specific item from a user\'s inventory.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to pickpocket')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item to steal')
                .setAutocomplete(true)
                .setRequired(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const targetUser = interaction.options.get('target')?.value;

        if (!targetUser) return interaction.respond([]);

        try {
            const userProfile = await EconomyUtils.getUser(targetUser);
            if (!userProfile || !userProfile.inventory) return interaction.respond([]);

            const inventoryKeys = Array.from(userProfile.inventory.keys());
            
            const items = inventoryKeys.map(key => {
                const itemConfig = EconomyConfig.items[key];
                if (!itemConfig || itemConfig.stealable === false) return null;
                const quantity = userProfile.inventory.get(key);
                if (quantity < 1) return null;
                return { name: `${itemConfig.name} (x${quantity})`, value: key };
            }).filter(Boolean);

            const filtered = items.filter(item => item.name.toLowerCase().includes(focusedValue.toLowerCase()));
            await interaction.respond(filtered.slice(0, 25));
        } catch (e) {
            return interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();
        const target = interaction.options.getUser('target');
        const itemKey = interaction.options.getString('item');

        if (target.bot) return interaction.followUp(ComponentUtils.createError('You cannot pickpocket a bot.'));
        if (target.id === interaction.user.id) return interaction.followUp(ComponentUtils.createError('You cannot pickpocket yourself.'));

        const commandName = 'pickpocket';
        const existingCooldown = await Cooldown.findOne({ userId: interaction.user.id, commandName });

        if (existingCooldown && existingCooldown.expiresAt > new Date()) {
            return interaction.followUp(ComponentUtils.createError(`You can pickpocket again <t:${Math.floor(existingCooldown.expiresAt.getTime() / 1000)}:R>.`));
        }

        const settings = await EconomyUtils.getSettings();
        const userData = await EconomyUtils.getUser(interaction.user.id);
        const globalMultiplier = settings.cooldownMultiplier || 1.0;
        const userMultiplier = userData.cooldownMultiplier || 1.0;
        const cooldownTime = 300_000 * globalMultiplier * userMultiplier; // 5 mins

        await Cooldown.findOneAndUpdate(
            { userId: interaction.user.id, commandName },
            {
                userId: interaction.user.id,
                commandName,
                expiresAt: new Date(Date.now() + cooldownTime)
            },
            { upsert: true, new: true }
        );

        const result = await EconomyUtils.pickpocketItem(target.id, interaction.user.id, itemKey);

        if (result.reason === 'invalid_item') {
            return interaction.followUp(ComponentUtils.createError('Invalid item or item cannot be stolen.'));
        }
        if (result.reason === 'no_item') {
            return interaction.followUp(ComponentUtils.createError('The target does not have that item.'));
        }

        const itemConfig = result.itemConfig;

        if (result.reason === 'zipper') {
            await EconomyUtils.dmUser(target, ComponentUtils.createError(`🚨 **PICKPOCKET THWARTED!** 🚨\n**${interaction.user.username}** tried to pickpocket your ${itemConfig.emoji} **${itemConfig.name}**, but your **Pocket Zipper** protected it! Your Zipper was destroyed in the process.`));
            return interaction.followUp(ComponentUtils.createError(`❌ You tried to steal **${itemConfig.name}** from ${target}, but they had a **Pocket Zipper**! You failed and their Zipper broke.`));
        }

        if (result.reason === 'failed') {
            await EconomyUtils.dmUser(target, ComponentUtils.createError(`⚠️ **PICKPOCKET ATTEMPT!** ⚠️\n**${interaction.user.username}** tried to pickpocket your ${itemConfig.emoji} **${itemConfig.name}**, but they failed and were caught!`));
            return interaction.followUp(ComponentUtils.createError(`❌ You tried to steal **${itemConfig.emoji} ${itemConfig.name}** from ${target}, but you failed to grab it!`));
        }

        if (result.reason === 'success') {
            await EconomyUtils.dmUser(target, ComponentUtils.createError(`🚨 **YOU WERE PICKPOCKETED!** 🚨\n**${interaction.user.username}** successfully reached into your inventory and stole your ${itemConfig.emoji} **${itemConfig.name}**!`));
            
            // Breaking news for exotic items (<= 4 dropWeight)
            let dropW = itemConfig.dropWeight !== undefined ? itemConfig.dropWeight : 100;
            if (dropW === 0) dropW = 100;
            
            if (dropW <= 4) {
                await EconomyUtils.postNewsEvent(
                    interaction.guild,
                    `# 🚨 EXOTIC HEIST\n**${interaction.user}** just successfully pickpocketed ${itemConfig.emoji} **${itemConfig.name}** right out of **${target}**'s pockets!`,
                    EconomyConfig.failColor
                );
            }

            const embed = new EmbedBuilder()
                .setTitle('🧤 Successful Pickpocket!')
                .setDescription(`You successfully stole ${itemConfig.emoji} **${itemConfig.name}** from ${target}!`)
                .setColor(EconomyConfig.successColor);

            return interaction.followUp({ embeds: [embed] });
        }
    }
};
