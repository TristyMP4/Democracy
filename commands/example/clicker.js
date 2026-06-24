const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
	dev: true,
	data: new SlashCommandBuilder()
		.setName('clicker')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setDescription('haha button go brrr'),
	async execute(interaction, client) {
		const button = new ButtonBuilder()
		.setCustomId('clicker')
		.setStyle(ButtonStyle.Primary)
		.setLabel('Click me!');

		const row = new ActionRowBuilder()
		.addComponents(button);

		let clickCount = 0;

		const message = await interaction.reply({
			content: 'Click the button!',
			components: [row],
		});

		const collector = message.createMessageComponentCollector({
			filter: i => i.customId === 'clicker'
		});

		collector.on('collect', async i => {
			clickCount++;
			await i.update({
				content: `You clicked the button ${clickCount} times!`
			});
		});
	}
}