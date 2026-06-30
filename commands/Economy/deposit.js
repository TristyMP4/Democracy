const { SlashCommandBuilder, EmbedBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const EconomyUser = require('../../schemas/EconomyUser.js');
const EconomyConfig = require('../../utils/EconomyConfig.js');
const parseAmount = require('../../utils/AmountParser.js');

module.exports = {
    economy: true,
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit money from your wallet into your bank.')
        .addStringOption(option => 
            option.setName('amount')
                .setDescription('Amount to deposit (e.g. 1234, 2k, 30%, max)')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const amountInput = interaction.options.getString('amount');

        try {
            let userData = await EconomyUser.findOne({ userId: interaction.user.id });
            if (!userData || userData.wallet <= 0) {
                return interaction.followUp({ 
                    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ You do not have any money in your wallet to deposit!`))],
                    flags: MessageFlags.HasComponentsV2
                });
            }

            const amountToDeposit = parseAmount(amountInput, userData.wallet);

            if (amountToDeposit <= 0) {
                return interaction.followUp({ 
                    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ Invalid amount. Please enter a valid number, shorthand (e.g. 2k), or percentage (e.g. 50%).`))],
                    flags: MessageFlags.HasComponentsV2
                });
            }

            if (amountToDeposit > userData.wallet) {
                return interaction.followUp({ 
                    components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ You only have **${EconomyConfig.currencySymbol}${userData.wallet.toLocaleString()}** in your wallet!`))],
                    flags: MessageFlags.HasComponentsV2
                });
            }

            userData.wallet -= amountToDeposit;
            userData.bank += amountToDeposit;

            await userData.save();

            const embed = new EmbedBuilder()
                .setTitle('🏦 Deposit Successful')
                .setDescription(`You deposited **${EconomyConfig.currencySymbol}${amountToDeposit.toLocaleString()}** into your bank.\n\n**New Wallet:** ${EconomyConfig.currencySymbol}${userData.wallet.toLocaleString()}\n**New Bank:** ${EconomyConfig.currencySymbol}${userData.bank.toLocaleString()}`)
                .setColor(EconomyConfig.successColor);

            await interaction.followUp({ embeds: [embed] });

        } catch (error) {
            console.error('Deposit Error:', error);
            await interaction.followUp({ 
                components: [new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`❌ An error occurred while depositing.`))],
                flags: MessageFlags.HasComponentsV2
            });
        }
    }
};
