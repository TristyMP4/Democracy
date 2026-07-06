const { SlashCommandBuilder, ContainerBuilder } = require('discord.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const ItemsConfig = require('../../configs/ItemsConfig.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');

function getRarity(weight) {
    if (weight == 0) return 'Unobtainable';
    if (weight >= 60) return 'Common';
    if (weight >= 40) return 'Uncommon';
    if (weight >= 20) return 'Rare';
    if (weight >= 12) return 'Epic';
    if (weight >= 4) return 'Legendary';
    return 'Exotic';
}

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('item')
        .setDescription('View detailed information about a specific item.')
        .addStringOption(option =>
            option
                .setName('item')
                .setDescription('The item you want to inspect')
                .setAutocomplete(true)
                .setRequired(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = Object.entries(ItemsConfig).map(([key, item]) => ({
            name: item.name,
            value: key
        }));

        const filtered = choices.filter(choice => 
            choice.name.toLowerCase().includes(focusedValue)
        ).slice(0, 25);

        await interaction.respond(filtered);
    },

    async execute(interaction) {
        const itemKey = interaction.options.getString('item');
        const item = ItemsConfig[itemKey];

        if (!item) {
            return interaction.reply(
                ComponentUtils.createError(`I couldn't find an item with the ID \`${itemKey}\`. Please use the autocomplete options.`)
            );
        }

        const actualWeight = item.dropWeight !== undefined ? item.dropWeight : 100;
        const rarityString = getRarity(actualWeight);
        
        const baseSellPrice = item.sellPrice !== undefined ? item.sellPrice : item.price;
        const sellableStr = item.sellable && baseSellPrice ? `✅ Yes (${EconomyConfig.currencySymbol}${baseSellPrice.toLocaleString()})` : '❌ No';
        
        const usableStr = item.usable ? '✅ Yes' : '❌ No';
        const emojiDisplay = item.emoji || '📦';
        const priceDisplay = item.price ? `${EconomyConfig.currencySymbol}${item.price.toLocaleString()}` : 'Not for sale';

        const titleDisplay = ComponentUtils.createText(`### ${emojiDisplay} **${item.name}**`);
        const descDisplay = ComponentUtils.createText(item.description || '*No description provided.*');
        
        const priceField = ComponentUtils.createText(`**Value**\n${priceDisplay}`);
        const rarityField = ComponentUtils.createText(`**Rarity**\n${rarityString} *(Weight: ${actualWeight})*`);
        
        const sellableField = ComponentUtils.createText(`**Sellable**\n${sellableStr}`);
        const usableField = ComponentUtils.createText(`**Usable**\n${usableStr}`);

        let weaponStats = [];
        if (item.ammo && item.ammo.length > 0) {
            const requiredAmmo = EconomyConfig.items[item.ammo[0]];
            const ammoDisplay = requiredAmmo ? `${requiredAmmo.emoji} ${requiredAmmo.name}` : item.ammo[0];
            const ammoField = ComponentUtils.createText(`**Ammo Type**\n${ammoDisplay}`);
            
            const damageField = ComponentUtils.createText(`**Damage**\n${(item.damagePercentage * 100).toFixed(0)}%`);
            const durabilityField = ComponentUtils.createText(`**Durability**\n${(item.durabilityPercentage * 100).toFixed(0)}%`);
            
            weaponStats = [ammoField, damageField, durabilityField];
        }

        const container = new ContainerBuilder()
            .setAccentColor(0x2b2d31) // subtle grey
            .addTextDisplayComponents(titleDisplay)
            .addSeparatorComponents(ComponentUtils.createSeparator())
            .addTextDisplayComponents(descDisplay)
            .addSeparatorComponents(ComponentUtils.createSeparator())
            .addTextDisplayComponents(priceField, rarityField)
            .addTextDisplayComponents(sellableField, usableField);

        if (weaponStats.length > 0) {
            container.addSeparatorComponents(ComponentUtils.createSeparator());
            // Group them to match columns if needed, but adding all three works
            container.addTextDisplayComponents(weaponStats[0], weaponStats[1], weaponStats[2]);
        }

        await interaction.reply(ComponentUtils.createContainerResponse(container));
    }
};
