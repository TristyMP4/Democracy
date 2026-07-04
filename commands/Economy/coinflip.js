const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin to double your money!')
        .addIntegerOption(option => 
            option.setName('bet')
                .setDescription('The amount of money to bet')
                .setRequired(true)
                .setMinValue(100)
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
            const bet = interaction.options.getInteger('bet');
            const chosenSide = interaction.options.getString('side');

            let user = await EconomyUtils.getUser(interaction.user.id);
            if ((user.wallet + user.bank) < bet) {
                return interaction.followUp(ComponentUtils.createError(`You do not have enough money to bet **${EconomyConfig.currencySymbol}${bet.toLocaleString()}**.`));
            }

            // Take money
            await EconomyUtils.removeCash(interaction.user.id, bet, 'cascade');

            // Roll
            const isHeads = Math.random() < 0.5;
            const resultSide = isHeads ? 'heads' : 'tails';
            const won = resultSide === chosenSide;

            const embed = new EmbedBuilder()
                .setTitle('🪙 Coin Flip')
                .setDescription(`The coin landed on **${resultSide.charAt(0).toUpperCase() + resultSide.slice(1)}**!`);

            if (won) {
                const winnings = bet * 2;
                await EconomyUtils.addCash(interaction.user.id, winnings, 'wallet');
                
                embed.setColor(EconomyConfig.successColor)
                     .setDescription(`${embed.data.description}\n\n🎉 You won **${EconomyConfig.currencySymbol}${winnings.toLocaleString()}**!`);
            } else {
                embed.setColor(EconomyConfig.failColor)
                     .setDescription(`${embed.data.description}\n\n💀 You lost your bet of **${EconomyConfig.currencySymbol}${bet.toLocaleString()}**.`);
            }

            // Get updated balance
            user = await EconomyUtils.getUser(interaction.user.id);
            embed.setFooter({ text: `Balance: ${EconomyConfig.currencySymbol}${(user.wallet + user.bank).toLocaleString()}` });

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Coinflip Error:', error);
            await interaction.followUp(ComponentUtils.createError('An error occurred while flipping the coin.'));
        }
    }
};
