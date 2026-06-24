const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
	owner: true,
	data: new SlashCommandBuilder()
		.setName('poke')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDescription('Poke the bot!'),
	async execute(interaction, client) {
		const button = new ButtonBuilder()
		.setCustomId('poke')
		.setStyle(ButtonStyle.Primary)
		.setLabel('Poke me!');

		const row = new ActionRowBuilder()
		.addComponents(button);

		await interaction.reply({
			content: 'Poke me!',
			components: [row],
		});

	}
}
