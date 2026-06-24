const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready', 
    once: true,
    async execute(client) { 
        client.user.setActivity({
            name: 'Promoting freedom',
            type: ActivityType.Custom,
         //   url: 'https://www.twitch.tv/discord'
        });
    },
};

