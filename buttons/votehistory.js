module.exports = {
    customId: 'view_history',

    async execute(interaction, client) {
        const userId = interaction.customId.split(':')[1];

        return interaction.reply({
            content: `User ID: ${userId}`,
            ephemeral: true
        });

        const data = await Stat.findOne({ userId });

        if (!data) {
            return interaction.reply({
                content: 'No history found.',
                ephemeral: true
            });
        }

        const mutes = data.votemutes.history || [];
        const kicks = data.votekicks.history || [];

        const format = (items) =>
            items.slice(-5).reverse().map(h =>
                `• <@${h.initiatedBy}> — ${h.reason || 'No reason'} (<t:${Math.floor(new Date(h.date)/1000)}:R>)`
            ).join('\n') || '*None*';

        const embed = new EmbedBuilder()
            .setTitle('📜 Vote History')
            .setColor(0x2f3136)
            .addFields(
                { name: '🔇 Mutes', value: format(mutes) },
                { name: '🛑 Kicks', value: format(kicks) }
            );

        return interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};