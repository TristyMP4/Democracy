const { SlashCommandBuilder, ContainerBuilder } = require('discord.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const ItemsConfig = require('../../Configs/ItemsConfig.js');

function getRarity(weight) {
    if (weight >= 60) return 'Common';
    if (weight >= 40) return 'Uncommon';
    if (weight >= 20) return 'Rare';
    if (weight >= 5) return 'Very Rare';
    if (weight >= 3) return 'Legendary';
    return 'Exotic';
}

module.exports = {
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

        const rarityString = getRarity(item.dropWeight || 100);
        const sellableStr = item.sellable ? '✅ Yes' : '❌ No';
        const usableStr = item.usable ? '✅ Yes' : '❌ No';
        const emojiDisplay = item.emoji || '📦';
        const priceDisplay = item.price ? `$${item.price.toLocaleString()}` : 'Not for sale';

        const titleDisplay = ComponentUtils.createText(`### ${emojiDisplay} **${item.name}**`);
        const descDisplay = ComponentUtils.createText(item.description || '*No description provided.*');
        
        const priceField = ComponentUtils.createText(`**Value**\n${priceDisplay}`);
        const rarityField = ComponentUtils.createText(`**Rarity**\n${rarityString} *(Weight: ${item.dropWeight || 0})*`);
        
        const sellableField = ComponentUtils.createText(`**Sellable**\n${sellableStr}`);
        const usableField = ComponentUtils.createText(`**Usable**\n${usableStr}`);

        const container = new ContainerBuilder()
            .setAccentColor(0x2b2d31) // subtle grey
            .addTextDisplayComponents(titleDisplay)
            .addSeparatorComponents(ComponentUtils.createSeparator())
            .addTextDisplayComponents(descDisplay)
            .addSeparatorComponents(ComponentUtils.createSeparator())
            .addTextDisplayComponents(priceField, rarityField)
            .addTextDisplayComponents(sellableField, usableField);

        await interaction.reply(ComponentUtils.createContainerResponse(container));
    }
};
