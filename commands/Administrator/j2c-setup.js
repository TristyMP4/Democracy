const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const JoinToCreate = require('../../schemas/JoinToCreate.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join-to-create-setup')
        .setDescription('Configure the Join-to-Create voice system.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The voice channel users should join to create a new one')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('category')
                .setDescription('The category where new voice channels will be created')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const setupChannel = interaction.options.getChannel('channel');
        const category = interaction.options.getChannel('category');

        try {
            await JoinToCreate.findOneAndUpdate(
                { guildId: interaction.guild.id },
                {
                    guildId: interaction.guild.id,
                    setupChannelId: setupChannel.id,
                    categoryId: category.id
                },
                { upsert: true, new: true }
            );

            const embed = new EmbedBuilder()
                .setTitle('✅ Join-to-Create Configured')
                .setDescription(`The system has been successfully setup!\n\n**Join Channel:** ${setupChannel}\n**Creation Category:** ${category}`)
                .setColor(0x2ecc71);

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('J2C Setup Error:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription('❌ Database error while setting up J2C.')
                ]
            });
        }
    }
};
