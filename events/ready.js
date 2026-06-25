const { ActivityType } = require('discord.js');

module.exports = {
    name: 'clientReady', 
    once: true,
    async execute(client) { 
        client.user.setActivity({
            name: 'We love voting 💯',
            type: ActivityType.Custom,
         //   url: 'https://www.twitch.tv/discord'
        });
    },
};

