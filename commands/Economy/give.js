const { SlashCommandBuilder, ContainerBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Give up to 3 items from your inventory to another user.')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to give items to')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('item1')
                .setDescription('The first item you want to give')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option => 
            option.setName('item2')
                .setDescription('The second item you want to give')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .addStringOption(option => 
            option.setName('item3')
                .setDescription('The third item you want to give')
                .setRequired(false)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        
        let userData = await EconomyUtils.getUser(interaction.user.id);
        let choices = [];

        if (userData && userData.inventory) {
            for (const [itemId, quantity] of userData.inventory.entries()) {
                if (quantity > 0) {
                    const itemConfig = EconomyConfig.items[itemId];
                    if (itemConfig) {
                        choices.push({ name: itemConfig.name, value: itemId });
                    }
                }
            }
        }

        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue)).slice(0, 25);
        await interaction.respond(filtered);
    },

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        
        if (targetUser.bot) {
            return interaction.reply(ComponentUtils.createError("You can't give items to a bot!"));
        }
        if (targetUser.id === interaction.user.id) {
            return interaction.reply(ComponentUtils.createError("You can't give items to yourself!"));
        }

        const selectedItems = [
            interaction.options.getString('item1'),
            interaction.options.getString('item2'),
            interaction.options.getString('item3')
        ].filter(Boolean);

        // Remove duplicates
        const uniqueItems = [...new Set(selectedItems)];
        
        let userData = await EconomyUtils.getUser(interaction.user.id);
        let itemsToGive = [];

        for (const itemId of uniqueItems) {
            const itemConfig = EconomyConfig.items[itemId];
            if (!itemConfig) {
                return interaction.reply(ComponentUtils.createError(`Item \`${itemId}\` does not exist.`));
            }

            const quantity = userData.inventory ? userData.inventory.get(itemId) || 0 : 0;
            if (quantity <= 0) {
                return interaction.reply(ComponentUtils.createError(`You don't have any **${itemConfig.name}** in your inventory.`));
            }

            itemsToGive.push({ id: itemId, config: itemConfig, available: quantity });
        }

        if (itemsToGive.length === 0) {
            return interaction.reply(ComponentUtils.createError("No valid items to give."));
        }

        const modalId = `give_modal_${interaction.id}`;
        const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle('Specify Quantities');

        for (let i = 0; i < itemsToGive.length; i++) {
            const item = itemsToGive[i];
            const max = item.available;
            
            const input = new TextInputBuilder()
                .setCustomId(`qty_${item.id}`)
                .setLabel(`Quantity for ${item.config.name} (Max: ${max})`)
                .setPlaceholder('Type a number or "all"')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
        }

        try {
            await interaction.showModal(modal);

            const submitted = await interaction.awaitModalSubmit({
                time: 60000,
                filter: i => i.user.id === interaction.user.id && i.customId === modalId
            }).catch(() => null);

            if (!submitted) return;
            
            await submitted.deferReply({ ephemeral: interaction.economySpamPrevention === true });

            // Re-fetch user data to prevent race conditions
            userData = await EconomyUtils.getUser(interaction.user.id);
            const parseAmount = require('../../utils/AmountParser.js');
            
            let finalGiveList = [];
            
            for (const item of itemsToGive) {
                const inputStr = submitted.fields.getTextInputValue(`qty_${item.id}`);
                const currentAvailable = userData.inventory ? userData.inventory.get(item.id) || 0 : 0;
                
                if (currentAvailable <= 0) continue;

                let parsedQty;
                try {
                    parsedQty = parseAmount(inputStr, currentAvailable);
                } catch (e) {
                    return submitted.followUp(ComponentUtils.createError(`Invalid amount provided for **${item.config.name}**.`));
                }

                if (parsedQty <= 0) {
                    return submitted.followUp(ComponentUtils.createError(`Quantity for **${item.config.name}** must be greater than 0.`));
                }
                if (parsedQty > currentAvailable) {
                    return submitted.followUp(ComponentUtils.createError(`You only have **${currentAvailable}x ${item.config.name}**.`));
                }

                finalGiveList.push({ id: item.id, config: item.config, amount: parsedQty });
            }

            if (finalGiveList.length === 0) {
                return submitted.followUp(ComponentUtils.createError("No valid items to give."));
            }

            // Perform the transfer
            for (const item of finalGiveList) {
                await EconomyUtils.removeItem(interaction.user.id, item.id, item.amount);
                await EconomyUtils.addItem(targetUser.id, item.id, item.amount);
            }

            let summaryText = '';
            for (const item of finalGiveList) {
                summaryText += `${item.config.emoji || '📦'} **${item.amount.toLocaleString()}x ${item.config.name}**\n`;
            }

            const titleDisplay = ComponentUtils.createText(`### 🎁 **Items Given!**`);
            const descDisplay = ComponentUtils.createText(`-# You successfully gave items to ${targetUser}:\n\n${summaryText}`);

            const container = new ContainerBuilder()
                .setAccentColor(EconomyConfig.successColor)
                .addTextDisplayComponents(titleDisplay)
                .addSeparatorComponents(ComponentUtils.createSeparator())
                .addTextDisplayComponents(descDisplay);

            await submitted.followUp(ComponentUtils.createContainerResponse(container));

            const dmEmbed = new EmbedBuilder()
                .setTitle('🎁 Items Received!')
                .setDescription(`**${interaction.user.username}** has given you the following items in **${interaction.guild.name}**:\n\n${summaryText}`)
                .setColor(EconomyConfig.successColor);
            
            await EconomyUtils.dmUser(targetUser, { embeds: [dmEmbed] });

        } catch (error) {
            console.error('Give error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply(ComponentUtils.createError('An error occurred while giving items.'));
            }
        }
    }
};
