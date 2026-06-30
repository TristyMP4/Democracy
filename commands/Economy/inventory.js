const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomyConfig = require('../../utils/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('Check your items.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to check the inventory of')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;

        if (targetUser.bot) {
            return interaction.followUp(ComponentUtils.createError('❌ Bots do not have inventories!'));
        }

        try {
            const userData = await EconomyUser.findOne({ userId: targetUser.id });
            
            if (!userData || !userData.inventory || userData.inventory.size === 0) {
                return interaction.followUp({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`🎒 ${targetUser.username}'s Inventory`)
                            .setDescription('This inventory is completely empty.')
                            .setColor(EconomyConfig.embedColor)
                    ]
                });
            }

            let inventoryList = '';
            
            // Iterate over the Map of items
            for (const [itemId, quantity] of userData.inventory.entries()) {
                if (quantity > 0) {
                    const itemConfig = EconomyConfig.items[itemId];
                    if (itemConfig) {
                        const totalValue = itemConfig.price * quantity;
                        inventoryList += `${itemConfig.emoji} **${itemConfig.name}** - \`${quantity}\` (Value: ${EconomyConfig.currencySymbol}${itemConfig.price.toLocaleString()} / Total: ${EconomyConfig.currencySymbol}${totalValue.toLocaleString()})\n*${itemConfig.description}*\n\n`;
                    }
                }
            }

            if (inventoryList.length === 0) {
                inventoryList = 'This inventory is completely empty.';
            }

            const embed = new EmbedBuilder()
                .setTitle(`🎒 ${targetUser.username}'s Inventory`)
                .setDescription(inventoryList)
                .setColor(EconomyConfig.embedColor)
                .setThumbnail(targetUser.displayAvatarURL());

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Inventory Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred while checking the inventory.'));
        }
    }
};
