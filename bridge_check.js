const { Player } = require('discord-player');
const { Client } = require('discord.js');
const client = new Client({ intents: [] });
const player = new Player(client);
console.log('Player Options keys:', Object.keys(player.options));
console.log('bridgeProvider:', typeof player.options.bridgeProvider);
process.exit(0);
