const { EmbedBuilder } = require('discord.js');

/**
 * Registers event handlers on the discord-player instance.
 * Sends embed notifications to the text channel stored in queue.metadata.
 * @param {import('discord-player').Player} player
 */
module.exports = function (player) {

    // Fires when a new track starts playing
    player.events.on('playerStart', (queue, track) => {
        const channel = queue.metadata?.channel;
        if (!channel) return;

        // Skip if this was triggered directly by a /play command (within 2s)
        // The play command already sends its own response — this avoids a double message.
        // Auto-advance notifications (when one song ends and the next starts) still fire.
        if (queue.metadata?.lastPlayCommand && Date.now() - queue.metadata.lastPlayCommand < 2000) {
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🎶 Now Playing')
            .setDescription(`[**${track.title}**](${track.url})`)
            .addFields(
                { name: '👤 Artist', value: track.author || 'Unknown', inline: true },
                { name: '⏱️ Duration', value: track.duration || 'Live', inline: true },
                { name: '🎧 Requested by', value: `${track.requestedBy || 'Unknown'}`, inline: true }
            )
            .setColor(0x5865f2)
            .setTimestamp();

        if (track.thumbnail) embed.setThumbnail(track.thumbnail);

        channel.send({ embeds: [embed] }).catch(() => {});
    });

    // Fires when the queue runs out of tracks
    player.events.on('emptyQueue', (queue) => {
        const channel = queue.metadata?.channel;
        if (!channel) return;

        channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x95a5a6)
                    .setDescription('🎶 Queue has ended — add more songs to keep the party going!')
            ]
        }).catch(() => {});
    });

    // Fires when the voice channel empties (all users leave)
    player.events.on('emptyChannel', (queue) => {
        const channel = queue.metadata?.channel;
        if (!channel) return;

        channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x95a5a6)
                    .setDescription('👋 Voice channel is empty — disconnecting.')
            ]
        }).catch(() => {});
    });

    // Fires on a playback-level error (bad stream, codec issue, etc.)
    player.events.on('playerError', (queue, error) => {
        console.error(`[MUSIC] Player error: ${error.message}`);
        const channel = queue.metadata?.channel;
        if (!channel) return;

        channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0xe74c3c)
                    .setDescription(`❌ Playback error:\n\`\`\`${error.message}\`\`\``)
            ]
        }).catch(() => {});
    });

    // Fires on a general queue/connection error
    player.events.on('error', (queue, error) => {
        console.error(`[MUSIC] Queue error: ${error.message}`);
    });

    console.log('Loaded music event handlers');
};
