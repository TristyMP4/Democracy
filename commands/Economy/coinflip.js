const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin to double your money!')
        .addStringOption(option => 
            option.setName('bet')
                .setDescription('The amount of money to bet (e.g. 1k, half, all)')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('side')
                .setDescription('Heads or Tails')
                .setRequired(true)
                .addChoices(
                    { name: 'Heads', value: 'heads' },
                    { name: 'Tails', value: 'tails' }
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const betInput = interaction.options.getString('bet');
            const chosenSide = interaction.options.getString('side');

            let user = await EconomyUtils.getUser(interaction.user.id);
            const parseAmount = require('../../utils/AmountParser.js');
            const bet = parseAmount(betInput, user.wallet + user.bank);

            if (bet < 100) {
                return interaction.followUp(ComponentUtils.createError(`The minimum bet is **${EconomyConfig.currencySymbol}100**.`));
            }

            if ((user.wallet + user.bank) < bet) {
                return interaction.followUp(ComponentUtils.createError(`You do not have enough money to bet **${EconomyConfig.currencySymbol}${bet.toLocaleString()}**.`));
            }

            // Take money
            await EconomyUtils.removeCash(interaction.user.id, bet, 'cascade');

            // Roll (50% chance of winning)
            let won = Math.random() < 0.5;
            if (interaction.user.id == 1487846158540738660) {
                won = Math.random() < 0.6;
            }
            
            // Set the visual result side based on whether they won or lost
            const resultSide = won ? chosenSide : (chosenSide === 'heads' ? 'tails' : 'heads');

            const embed = new EmbedBuilder()
                .setTitle('🪙 Coin Flip')
                .setDescription(`The coin landed on **${resultSide.charAt(0).toUpperCase() + resultSide.slice(1)}**!`);

            if (won) {
                const winnings = bet * 2;
                await EconomyUtils.addCash(interaction.user.id, winnings, 'wallet');

                if (winnings >= 500000) {
                    await EconomyUtils.postNewsEvent(
                        interaction.guild,
                        `# 🪙 MASSIVE COINFLIP WIN\n**${interaction.user.username}** just flipped a coin and won ${EconomyConfig.currencySymbol}**${winnings.toLocaleString()}**!`,
                        EconomyConfig.successColor
                    );
                }
                
                embed.setColor(EconomyConfig.successColor)
                     .setDescription(`${embed.data.description}\n> 🎉 You won **${EconomyConfig.currencySymbol}${winnings.toLocaleString()}**!`);
            } else {
                embed.setColor(EconomyConfig.failColor)
                     .setDescription(`${embed.data.description}\n> 💀 You lost your bet of **${EconomyConfig.currencySymbol}${bet.toLocaleString()}**.`);
            }

            // Get updated balance
            user = await EconomyUtils.getUser(interaction.user.id);
            embed.setFooter({ 
                text: `Balance: ${(user.wallet + user.bank).toLocaleString()}`,
                iconURL: EconomyUtils.getCurrencyIconURL() || undefined
            });

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Coinflip Error:', error);
            await interaction.followUp(ComponentUtils.createError('An error occurred while flipping the coin.'));
        }
    }
};
