const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');
const EconomyUtils = require('../../utils/EconomyUtils.js');
const ComponentUtils = require('../../utils/ComponentUtils.js');

module.exports = {
    admin: true,
    data: new SlashCommandBuilder()
        .setName('setnewschannel')
        .setDescription('Sets the channel where big economy events will be broadcasted.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The text channel to set as the news channel.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();
        
        const channel = interaction.options.getChannel('channel');
        
        const settings = await EconomyUtils.getGuildSettings(interaction.guild.id);
        settings.newsChannelId = channel.id;
        await settings.save();

        return interaction.followUp(
            ComponentUtils.createSuccess(`Successfully set the news channel to ${channel}! Big events like assassinations, massive casino wins, and exotic item drops will now be broadcasted here.`)
        );
    }
};
