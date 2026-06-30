const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomyConfig = require('../../utils/EconomyConfig.js');

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
            return interaction.followUp({ 
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ You cannot pay a bot!`))],
                flags: MessageFlags.HasComponentsV2,
                ephemeral: true 
            });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.followUp({ 
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ You cannot pay yourself!`))],
                flags: MessageFlags.HasComponentsV2,
                ephemeral: true 
            });
        }

        try {
            // Find sender
            let senderData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!senderData || senderData.wallet < amount) {
                return interaction.followUp({ 
                    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ You do not have **${EconomyConfig.currencySymbol}${amount.toLocaleString()}** in your wallet!`))],
                    flags: MessageFlags.HasComponentsV2,
                    ephemeral: true 
                });
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
            await interaction.followUp({ 
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ An error occurred during the transaction.`))],
                flags: MessageFlags.HasComponentsV2,
                ephemeral: true 
            });
        }
    }
};
