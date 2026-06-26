const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Shows all active invite links for the server.'),

    async execute(interaction) {
        // Defer reply as an ephemeral message
        await interaction.deferReply({ ephemeral: true });

        try {
            // Check if the bot has permission to fetch invites
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xe74c3c)
                            .setDescription('❌ I need the **Manage Server** permission to view invites.')
                    ]
                });
            }

            // Fetch all invites for the guild
            const invites = await interaction.guild.invites.fetch();

            if (invites.size === 0) {
                return interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xf1c40f)
                            .setDescription('There are currently no active invite links for this server.')
                    ]
                });
            }

            // Sort invites by uses (descending)
            const sortedInvites = invites.sort((a, b) => b.uses - a.uses);

            // Format the invite list
            let inviteList = '';
            sortedInvites.forEach(invite => {
                inviteList += `\`discord.gg/${invite.code}\``;
            });

            // Discord embed descriptions have a 4096 character limit. 
            // If there are tons of invites, we need to truncate it.
            if (inviteList.length > 4096) {
                inviteList = inviteList.substring(0, 4090) + '...';
            }

            const embed = new EmbedBuilder()
                .setTitle(`📨 Active Invites`)
                .setDescription(inviteList)
                .setColor(0x5865f2)
                .setFooter({ text: `Total Invites: ${invites.size}` });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching invites:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xe74c3c)
                        .setDescription('❌ An error occurred while fetching the invites.')
                ]
            });
        }
    }
};
