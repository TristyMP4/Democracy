const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomyConfig = require('../../utils/EconomyConfig.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Sell an item from your inventory for money.')
        .addStringOption(option => 
            option.setName('item')
                .setDescription('The ID of the item you want to sell (e.g. ak-alpha, semi-automatic-pistol)')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of this item to sell (default 1)')
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        let userData = await EconomyUser.findOne({ userId: interaction.user.id });
        let choices = [];

        if (userData && userData.inventory) {
            for (const [itemId, quantity] of userData.inventory.entries()) {
                if (quantity > 0) {
                    const itemConfig = EconomyConfig.items[itemId];
                    if (itemConfig && itemConfig.sellable) {
                        choices.push({ name: itemConfig.name, value: itemId });
                    }
                }
            }
        }

        // Filter based on focused value and limit to 25
        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue)).slice(0, 25);
        await interaction.respond(filtered);
    },

    async execute(interaction) {
        await interaction.deferReply();

        const itemInput = interaction.options.getString('item').toLowerCase();
        let amount = interaction.options.getInteger('amount') || 1;

        if (amount < 1) {
            return interaction.followUp({ 
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ You must sell at least 1 item.`))],
                flags: MessageFlags.HasComponentsV2,
                ephemeral: true 
            });
        }

        // Validate item exists in game
        const itemConfig = EconomyConfig.items[itemInput];
        if (!itemConfig) {
            return interaction.followUp({ 
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ That item does not exist! Try checking your \`/inventory\` for the correct ID.`))],
                flags: MessageFlags.HasComponentsV2,
                ephemeral: true 
            });
        }

        try {
            let userData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!userData || !userData.inventory || !userData.inventory.get(itemInput) || userData.inventory.get(itemInput) < amount) {
                return interaction.followUp({ 
                    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ You do not have enough **${itemConfig.name}** to sell!`))],
                    flags: MessageFlags.HasComponentsV2,
                    ephemeral: true 
                });
            }

            // Deduct from inventory
            const currentAmount = userData.inventory.get(itemInput);
            if (currentAmount === amount) {
                userData.inventory.delete(itemInput);
            } else {
                userData.inventory.set(itemInput, currentAmount - amount);
            }

            // Add money
            const totalValue = itemConfig.price * amount;
            userData.wallet += totalValue;

            await userData.save();

            const embed = new EmbedBuilder()
                .setTitle('🛒 Items Sold')
                .setDescription(`You successfully sold **${amount}x** ${itemConfig.emoji} **${itemConfig.name}** for **${EconomyConfig.currencySymbol}${totalValue.toLocaleString()}** ${EconomyConfig.currencyCode}!`)
                .setColor(EconomyConfig.successColor);

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Sell Error:', error);
            await interaction.followUp({ 
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ An error occurred while selling the item.`))],
                flags: MessageFlags.HasComponentsV2,
                ephemeral: true 
            });
        }
    }
};
