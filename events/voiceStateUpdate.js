const { ChannelType, PermissionFlagsBits } = require('discord.js');
const JoinToCreate = require('../schemas/JoinToCreate.js');

module.exports = {
    name: 'voiceStateUpdate',
    once: false,
    async execute(client, oldState, newState) {
        if (newState.member.user.bot) return;

        // Automatically un-server-mute and un-server-deafen when joining a VC
        if (newState.channelId && oldState.channelId !== newState.channelId) {
            if (newState.serverMute || newState.serverDeaf) {
                newState.member.edit({ mute: false, deaf: false }).catch(console.error);
            }
        }

        try {
            const j2cData = await JoinToCreate.findOne({ guildId: newState.guild.id });
            if (!j2cData) return;

            const { setupChannelId, categoryId } = j2cData;
            if (newState.channelId === setupChannelId) {
                // Ensure category exists
                const category = newState.guild.channels.cache.get(categoryId);
                if (!category) return;

                // Create the new channel
                const newChannel = await newState.guild.channels.create({
                    name: `${newState.member.user.username}'s Channel`,
                    type: ChannelType.GuildVoice,
                    parent: categoryId,
                    permissionOverwrites: [
                        {
                            id: newState.guild.id, // @everyone
                            allow: [], // Default view/connect based on category
                        },
                        {
                            id: newState.member.id, // The creator
                            allow: [
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.MuteMembers,
                                PermissionFlagsBits.DeafenMembers,
                                PermissionFlagsBits.MoveMembers,
                                PermissionFlagsBits.ManageRoles // Allows modifying specific channel permissions for others
                            ],
                        }
                    ]
                });
                await newState.member.voice.setChannel(newChannel);
                j2cData.createdChannels.push(newChannel.id);
                await j2cData.save();
            }
            if (oldState.channelId && oldState.channelId !== newState.channelId) {
                const oldChannel = oldState.channel;
                if (oldChannel && j2cData.createdChannels.includes(oldChannel.id)) {
                    // Check if empty
                    if (oldChannel.members.size === 0) {
                        // Delete it
                        await oldChannel.delete().catch(() => {});
                        // Remove from tracking
                        j2cData.createdChannels = j2cData.createdChannels.filter(id => id !== oldChannel.id);
                        await j2cData.save();
                    }
                }
            }

        } catch (error) {
            console.error('J2C Error in voiceStateUpdate:', error);
        }
    }
};
