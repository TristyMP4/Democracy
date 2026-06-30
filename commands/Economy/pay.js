const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomyConfig = require('../../configs/EconomyConfig.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Give money to another user.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user you want to pay')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of money to send')
                .setMinValue(1)
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');

        if (targetUser.bot) {
            return interaction.followUp(ComponentUtils.createError('❌ You cannot pay a bot!'));
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.followUp(ComponentUtils.createError('❌ You cannot pay yourself!'));
        }

        try {
            // Find sender
            let senderData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!senderData || senderData.wallet < amount) {
                return interaction.followUp(ComponentUtils.createError(`❌ You do not have **${EconomyConfig.currencySymbol}${amount.toLocaleString()}** in your wallet!`));
            }

            // Find or create receiver
            let receiverData = await EconomyUser.findOne({ userId: targetUser.id });
            if (!receiverData) {
                receiverData = new EconomyUser({ userId: targetUser.id });
            }

            // Perform transaction
            senderData.wallet -= amount;
            receiverData.wallet += amount;

            await senderData.save();
            await receiverData.save();

            const embed = new EmbedBuilder()
                .setTitle('💸 Payment Successful')
                .setDescription(`You successfully sent **${EconomyConfig.currencySymbol}${amount.toLocaleString()}** to <@${targetUser.id}>!`)
                .setColor(EconomyConfig.successColor);

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Pay Error:', error);
            await interaction.followUp(ComponentUtils.createError('❌ An error occurred during the transaction.'));
        }
    }
};
