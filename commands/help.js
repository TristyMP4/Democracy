const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays an interactive list of all available commands.'),

    async execute(interaction, client) {
        // Collect all categories
        const categories = {};

        client.commands.forEach(cmd => {
            const cat = cmd.category || 'Miscellaneous';
            // Capitalize first letter
            const displayCat = cat.charAt(0).toUpperCase() + cat.slice(1);
            if (!categories[displayCat]) categories[displayCat] = [];
            categories[displayCat].push(cmd);
        });

        // Map emojis to categories
        const getEmoji = (cat) => {
            const lower = cat.toLowerCase();
            if (lower === 'economy') return '💰';
            if (lower === 'democracy') return '🗳️';
            if (lower === 'developer') return '👨‍💻';
            if (lower === 'administrator') return '⚙️';
            if (lower === 'miscellaneous') return '🗃️';
            return '📁'; // Default fallback
        };

        const getCategoryDescription = (cat) => {
            const lower = cat.toLowerCase();
            if (lower === 'economy') return 'Global money, items, and trading commands.';
            if (lower === 'democracy') return 'Base Democracy features; votekick, votemute, etc.';
            if (lower === 'developer') return 'Commands restricted to Developers.';
            if (lower === 'administrator') return 'Administrative commands for configuring the bot.';
            if (lower === 'miscellaneous') return 'Uncategorized and general utility commands.';
            return `View all ${cat} commands`;
        };

        const options = Object.keys(categories).map(cat => {
            return {
                label: cat,
                description: getCategoryDescription(cat),
                value: cat,
                emoji: getEmoji(cat)
            };
        });

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('help_category_select')
                    .setPlaceholder('Select a category to view commands...')
                    .addOptions(options)
            );

        const initialEmbed = new EmbedBuilder()
            .setTitle('❓ Command Help')
            .setDescription('Use the dropdown below to select a command category for Democracy.')
            .setColor(0x5865f2)
            .setThumbnail(client.user.displayAvatarURL());

        const response = await interaction.reply({ embeds: [initialEmbed], components: [row], fetchReply: true, ephemeral: true });

        // Fetch application commands so we can get their IDs for clickable mentions
        const appCommands = await client.application.commands.fetch().catch(() => new Map());

        // Create collector for 1 minute
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 60000,
            filter: i => i.user.id === interaction.user.id 
        });

        collector.on('collect', async i => {
            const selectedCategory = i.values[0];
            const cmds = categories[selectedCategory];

            let commandList = '';
            cmds.forEach(cmd => {
                // If the command is admin/owner locked, we can visually indicate it (optional)
                const lockIcon = cmd.admin ? ' *(Admin)*' : cmd.owner ? ' *(Owner)*' : '';
                
                // Match the local command to the API command to get its ID
                const apiCmd = appCommands.find(c => c.name === cmd.data.name);
                const clickableCommand = apiCmd ? `</${apiCmd.name}:${apiCmd.id}>` : `**/${cmd.data.name}**`;

                commandList += `${clickableCommand}${lockIcon} - ${cmd.data.description}\n\n`;
            });

            const embed = new EmbedBuilder()
                .setTitle(`${getEmoji(selectedCategory)} ${selectedCategory} Commands`)
                .setDescription(commandList)
                .setColor(0x5865f2)
                .setThumbnail(client.user.displayAvatarURL());

            await i.update({ embeds: [embed] });
        });

        collector.on('end', () => {
            // Disable the dropdown when the collector expires
            row.components[0].setDisabled(true);
            interaction.editReply({ components: [row] }).catch(() => {});
        });
    }
};
