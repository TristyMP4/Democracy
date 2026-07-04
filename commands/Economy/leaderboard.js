const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the wealthiest members of the server.')
        .addSubcommand(subcommand =>
            subcommand.setName('money')
                .setDescription('View the leaderboard based on raw money (Wallet + Bank).')
        )
        .addSubcommand(subcommand =>
            subcommand.setName('networth')
                .setDescription('View the leaderboard based on total net worth (Money + Inventory Value).')
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const subcommand = interaction.options.getSubcommand();
            const allUsers = await EconomyUtils.getAllUsers();
            
            if (!allUsers || allUsers.length === 0) {
                return interaction.followUp('There are no users in the economy system yet!');
            }

            let leaderboardData = [];

            for (const user of allUsers) {
                const discordUser = await interaction.client.users.fetch(user.userId).catch(() => null);
                if (!discordUser || discordUser.bot) continue;

                let score = user.wallet + user.bank;

                if (subcommand === 'networth' && user.inventory) {
                    for (const [itemKey, quantity] of user.inventory.entries()) {
                        const itemConfig = EconomyConfig.items[itemKey];
                        if (itemConfig && itemConfig.price) {
                            score += (itemConfig.price * quantity);
                        }
                    }
                }

                leaderboardData.push({
                    username: discordUser.username,
                    score: score
                });
            }

            // Sort descending and take top 10
            leaderboardData.sort((a, b) => b.score - a.score);
            const top10 = leaderboardData.slice(0, 10);

            const title = subcommand === 'money' ? '💰 Money Leaderboard' : '💎 Networth Leaderboard';
            
            let description = '';
            const medals = ['🥇', '🥈', '🥉'];
            
            if (top10.length === 0) {
                description = 'No users qualify for the leaderboard.';
            } else {
                top10.forEach((user, index) => {
                    const rank = index < 3 ? medals[index] : `**#${index + 1}**`;
                    description += `${rank} **${user.username}**: ${EconomyConfig.currencySymbol}${user.score.toLocaleString()}\n`;
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(EconomyConfig.embedColor);

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Leaderboard Error:', error);
            await interaction.followUp('❌ An error occurred while generating the leaderboard.');
        }
    }
};
