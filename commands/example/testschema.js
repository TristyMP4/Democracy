const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const testschema = require('../../schemas/example');
const { owner } = require('../say');

module.exports = {
    dev: true,
    data: new SlashCommandBuilder()
    .setName('test-schema')
    .setDescription('testschema')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(command => command.setName('add').setDescription('Add data').addStringOption(option => option.setName('schema-input').setDescription('text to save').setRequired(true)))
    .addSubcommand(command => command.setName('get').setDescription('Get data'))
    .addSubcommand(command => command.setName('remove').setDescription('Remove data')),
    async execute(interaction) { 

        const { options } = interaction;
        const sub = options.getSubcommand();
        const data = await testschema.find();

        switch (sub) {
            case 'add':
                const string = options.getString('schema-input');

                await testschema.create({
                    Content: string
                });

                await interaction.reply(`I saved the data`);
            break;
            case 'get':
                var values = [];
                await data.forEach(async d => {
                    values.push(d.Content);
                });

                await interaction.reply({ content: `${values.join('\n') || 'No content found'}`});
            break;
            case 'remove':
                await data.forEach(async d => {
                    await testschema.deleteOne({ name: d.name });
                });

                await interaction.reply({ content: `I deleted the values`});
        }
    }
}