const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    owner: true,
    data: new SlashCommandBuilder()
        .setName('restart')
        .setDescription('Initiates a bot restart [DEV COMMAND].')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setTitle('🔄 Bot Reboot')
                    .setDescription('🛠️ Democracy is restarting.. [PM2 RESTART]')
                    .setFooter({
                        text: 'PM2 will handle the reboot, bot should be back up shortly!'
                    })
            ],
            ephemeral: false // False so people can see the swag restart lmao
        });
        setTimeout(() => {
            process.exit(0);
        }, 1000); // 1s delay to ensure the Discord API has time to send the reply message
    }
};
