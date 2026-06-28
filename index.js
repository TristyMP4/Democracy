const { Client, PermissionsBitField, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const Stats = require("./schemas/stats.js")
require('dotenv').config();
const client = new Client({
    intents: [
        'Guilds',
        'GuildMembers',
        'GuildMessages',
        'GuildPresences',
        'DirectMessages',
        'MessageContent',
        'GuildVoiceStates',
    ],
    partials: ['CHANNEL', 'MESSAGE']
});

client.cooldowns = new Map();
client.cache = new Map();
// Each of these exports a function, it's the same as doing
// const ComponentLoader = require('./utils/ComponentLoader.js');
// ComponentLoader(client);
require('./utils/ComponentLoader.js')(client);
require('./utils/EventLoader.js')(client);
require('./utils/RegisterCommands.js')(client);

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Here we connect to the database
// It has been moved outside of the ready event so we don't have to wait on discord
// [Application startup] -> [client.login()] -> [Discord responds] -> [Ready event] -> [Database connection]
//
// This way we can connect to the database while waiting for discord to respond
// [Application startup] -> [Database connection] -> [client.login()] -> [Discord responds] -> [Ready event]
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
( async function() {
	if (!process.env.MONGOURL) return console.warn('MongoDB URL is not provided in the .env file, skipping database connection...');
	await mongoose.connect(process.env.MONGOURL);
})();

console.log(`Logging in...`);
client.login(process.env.TOKEN);
client.on('ready', function () {
    console.log(`Logged in as ${client.user.tag}!`);

	require('./utils/CheckIntents.js')(client);
});

client.on('messageCreate', () => {} )

async function InteractionHandler(interaction, type) {

    const component = client[type].get( interaction.customId ?? interaction.commandName );
    if (!component) {
        // console.error(`${type} not found: ${interaction.customId ?? interaction.commandName}`);
        return;
    }

    try {
        //command properties
        if (component.admin) {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) return await interaction.reply({ content: `⚠️ Only administrators can use this command!`, ephemeral: true });
        }

        if (component.owner) {
            if (interaction.user.id !== '1487846158540738660') return await interaction.reply({ content: `⚠️ Only bot owners can use this command!`, ephemeral: true });
        }

        //the mod command property requires additional setup, watch the video here to set it up: https://youtu.be/2Tqy6Cp_10I?si=bharHI_Vw7qjaG2Q

        /*
            COMMAND PROPERTIES:

            module.exports = {
                admin: true,
                data: new SlashCommandBuilder()
                .setName('test')
                .setDescription('test'),
                async execute(interaction) { 
                
                }
            }

            You can use command properties in the module.exports statement by adding a valid property to : true,

            VALID PROPERTIES:

            admin : true/false
            owner : true/false
			dev: true/false

            You can add more command properties by following the prompt below and pasting it above in location with all the other statements:
            
            if (component.propertyname) {
                if (logic statement logic) return await interaction.reply({ content: `⚠️ response to flag`, ephemeral: true });
            }
        */

        await component.execute(interaction, client);
    } catch (error) {
        console.error(error);
		// If there is already a response, say after a deferReply(), we override the response with an error message.
        await interaction.deferReply({ ephemeral: true }).catch( () => {} );
        await interaction.editReply({
            content: `There was an error while executing this command!\n\`\`\`${error}\`\`\``,
            embeds: [],
            components: [],
            files: []
        }).catch( () => {} );
    }
}

////////////////////////////////////////////////////////////////
// These are all the entry points for the interactionCreate event.
// This will run before any command processing, perfect for logs!
////////////////////////////////////////////////////////////////
client.on('interactionCreate', async function(interaction) {
    if (!interaction.isCommand()) return;
    await InteractionHandler(interaction, 'commands');
});


client.on('interactionCreate', async function(interaction) {
    if (!interaction.isButton()) return;
    await InteractionHandler(interaction, 'buttons');
});


client.on('interactionCreate', async function(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    await InteractionHandler(interaction, 'dropdowns');
});


client.on('interactionCreate', async function(interaction) {
    if (!interaction.isModalSubmit()) return;
    await InteractionHandler(interaction, 'modals');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (!interaction.customId.startsWith('view_history_')) return;

    const userId = interaction.customId.split('_')[2];
    const data = await Stats.findOne({ userId });

    if (!data) {
        return interaction.reply({
            content: 'No history found.',
            ephemeral: true
        });
    }

    const mutes = data.votemutes.history || [];
    const kicks = data.votekicks.history || [];

    const formatHistory = (items, type) => {
        if (!items.length) return `No ${type} history.`;

        return items
            .slice(-5) // last 5 entries
            .reverse()
            .map((h, i) => {
                const date = `<t:${Math.floor(new Date(h.date).getTime() / 1000)}:R>`;
                return `**${i + 1}.** <@${h.initiatedBy}> — *${h.reason || 'No reason'}*\n⏱ ${date}`;
            })
            .join('\n\n');
    };

    const historyEmbed = new EmbedBuilder()
        .setTitle('📜 Vote History')
        .setColor(0x2f3136)
        .addFields(
            {
                name: '🔇 Votemutes (last 5)',
                value: formatHistory(mutes, 'mute')
            },
            {
                name: '🛑 Votekicks (last 5)',
                value: formatHistory(kicks, 'kick')
            }
        )
        .setTimestamp();

    return interaction.reply({
        embeds: [historyEmbed],
        ephemeral: true
    });
});