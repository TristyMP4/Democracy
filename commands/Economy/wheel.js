const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('wheel')
        .setDescription('Spin the Rust Bandit Camp wheel!')
        .addStringOption(option => 
            option.setName('bet')
                .setDescription('The amount of money to bet (e.g. 1k, half, all)')
                .setRequired(true)
        )
        .addIntegerOption(option => 
            option.setName('number')
                .setDescription('The multiplier to bet on')
                .setRequired(true)
                .addChoices(
                    { name: '1', value: 1 },
                    { name: '3', value: 3 },
                    { name: '5', value: 5 },
                    { name: '10', value: 10 },
                    { name: '20', value: 20 }
                )
        ),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const betInput = interaction.options.getString('bet');
            const chosenNumber = interaction.options.getInteger('number');

            let user = await EconomyUtils.getUser(interaction.user.id);
            const parseAmount = require('../../utils/AmountParser.js');
            const bet = parseAmount(betInput, user.wallet + user.bank);

            if (bet < 100) {
                return interaction.followUp(ComponentUtils.createError(`The minimum bet is **${EconomyConfig.currencySymbol}100**.`));
            }

            if ((user.wallet + user.bank) < bet) {
                return interaction.followUp(ComponentUtils.createError(`You do not have enough money to bet **${EconomyConfig.currencySymbol}${bet.toLocaleString()}**.`));
            }

            // Deduct the bet immediately
            await EconomyUtils.removeCash(interaction.user.id, bet, 'cascade');

            // Send spinning animation
            const spinEmbed = new EmbedBuilder()
                .setTitle('🎡 Spinning the Wheel...')
                .setDescription(`You placed a **${EconomyConfig.currencySymbol}${bet.toLocaleString()}** bet on **${chosenNumber}**.\n\n*Waiting for the wheel to stop...*`)
                .setImage(EconomyConfig.gambling.wheel.gifUrl)
                .setColor(EconomyConfig.embedColor);

            await interaction.followUp({ embeds: [spinEmbed] });

            // Calculate Outcome
            const slots = EconomyConfig.gambling.wheel.slots;
            const totalWeight = slots.reduce((acc, slot) => acc + slot.weight, 0);
            
            let random = Math.random() * totalWeight;
            let resultSlot = slots[0];

            for (const slot of slots) {
                if (random < slot.weight) {
                    resultSlot = slot;
                    break;
                }
                random -= slot.weight;
            }

            // Wait 4 seconds for the "spin" effect
            await new Promise(resolve => setTimeout(resolve, 4000));

            const won = resultSlot.number === chosenNumber;
            const resultEmbed = new EmbedBuilder()
                .setTitle(`🎡 The wheel stopped on ${resultSlot.emoji} ${resultSlot.number}!`);

            if (won) {
                // Return their initial bet PLUS their winnings (bet * number)
                const winnings = bet + (bet * chosenNumber);
                await EconomyUtils.addCash(interaction.user.id, winnings, 'wallet');
                
                resultEmbed.setColor(EconomyConfig.successColor)
                           .setDescription(`You bet on **${chosenNumber}** and won!\n\n🎉 Payout: **${EconomyConfig.currencySymbol}${winnings.toLocaleString()}**`);
            } else {
                resultEmbed.setColor(EconomyConfig.failColor)
                           .setDescription(`You bet on **${chosenNumber}** and lost.\n\n💀 You lost your bet of **${EconomyConfig.currencySymbol}${bet.toLocaleString()}**.`);
            }

            user = await EconomyUtils.getUser(interaction.user.id);
            resultEmbed.setFooter({ 
                text: `Balance: ${(user.wallet + user.bank).toLocaleString()}`,
                iconURL: EconomyUtils.getCurrencyIconURL() || undefined
            });

            await interaction.editReply({ embeds: [resultEmbed] });

        } catch (error) {
            console.error('Wheel Error:', error);
            // We use editReply here in case the error happens after followUp was already sent
            await interaction.editReply(ComponentUtils.createError('An error occurred while spinning the wheel.')).catch(() => {});
        }
    }
};
