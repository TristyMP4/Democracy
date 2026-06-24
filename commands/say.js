const { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
	owner: true,
	data: new SlashCommandBuilder()
		.setName('say')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDescription('Say something!'),
	async execute(interaction, client) {
		const modal = new ModalBuilder()
		 .setTitle('Say something!')
		.setCustomId('say')

		const input = new TextInputBuilder()
		.setCustomId('message')
		.setPlaceholder('Type something...')
		.setLabel('Message')
		.setStyle(TextInputStyle.Paragraph)

		const question = new ActionRowBuilder()
		.addComponents(input)

		modal.addComponents(question)

		await interaction.showModal(modal)
	}
}