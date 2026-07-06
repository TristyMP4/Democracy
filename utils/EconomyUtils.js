const EconomyUser = require('../schemas/EconomyUser.js');
const EconomySettings = require('../schemas/EconomySettings.js');
const GuildSettings = require('../schemas/GuildSettings.js');
const EconomyConfig = require('../configs/EconomyConfig.js');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    /**
     * Gets a user from the economy database, or creates one if it doesn't exist
     * @param {string} userId The discord user ID
     * @returns {Promise<EconomyUser>}
     */
    async getUser(userId) {
        let user = await EconomyUser.findOne({ userId });
        if (!user) {
            user = new EconomyUser({ userId });
            await user.save();
            return user;
        }

        let changed = false;
        const now = new Date();
        if (user.luckExpiry && now > user.luckExpiry) {
            user.luckMultiplier = 1.0;
            user.luckExpiry = null;
            changed = true;
        }
        if (user.moneyExpiry && now > user.moneyExpiry) {
            user.moneyMultiplier = 1.0;
            user.moneyExpiry = null;
            changed = true;
        }
        if (user.cooldownExpiry && now > user.cooldownExpiry) {
            user.cooldownMultiplier = 1.0;
            user.cooldownExpiry = null;
            changed = true;
        }
        
        if (changed) await user.save();
        return user;
    },

    /**
     * Gets all users in the economy database (used for leaderboards)
     * @returns {Promise<EconomyUser[]>}
     */
    async getAllUsers() {
        return await EconomyUser.find({});
    },

    /**
     * Adds cash to a user
     * @param {string} userId The discord user ID
     * @param {number} amount The amount to add
     * @param {string} type 'wallet' or 'bank'
     * @returns {Promise<EconomyUser>}
     */
    async addCash(userId, amount, type = 'wallet') {
        const user = await this.getUser(userId);
        
        if (type === 'bank') {
            const capacity = user.bankCapacity || 50000;
            if (user.bank + amount > capacity) {
                const overflow = (user.bank + amount) - capacity;
                user.bank = capacity;
                user.wallet += overflow;
            } else {
                user.bank += amount;
            }
        } else {
            user[type] += amount;
        }
        
        await user.save();
        return user;
    },

    /**
     * Removes cash from a user, preventing negative balances
     * @param {string} userId The discord user ID
     * @param {number} amount The amount to remove
     * @param {string} type 'wallet', 'bank', or 'cascade' (wallet then bank)
     * @returns {Promise<{user: EconomyUser, actualRemoved: number}>}
     */
    async removeCash(userId, amount, type = 'wallet') {
        const user = await this.getUser(userId);
        let actualRemoved = 0;

        if (type === 'cascade') {
            let remaining = amount;
            if (user.wallet >= remaining) {
                user.wallet -= remaining;
                actualRemoved += remaining;
                remaining = 0;
            } else {
                actualRemoved += user.wallet;
                remaining -= user.wallet;
                user.wallet = 0;
                
                if (user.bank >= remaining) {
                    user.bank -= remaining;
                    actualRemoved += remaining;
                    remaining = 0;
                } else {
                    actualRemoved += user.bank;
                    remaining -= user.bank;
                    user.bank = 0;
                }
            }
        } else {
            if (user[type] < amount) {
                actualRemoved = user[type];
                user[type] = 0;
            } else {
                actualRemoved = amount;
                user[type] -= amount;
            }
        }
        
        await user.save();
        return { user, actualRemoved };
    },

    /**
     * Adds an item to a user's inventory
     * @param {string} userId The discord user ID
     * @param {string} itemKey The key of the item from ItemsConfig
     * @param {number} amount Amount of items to add
     * @returns {Promise<EconomyUser>}
     */
    async addItem(userId, itemKey, amount = 1) {
        const user = await this.getUser(userId);
        if (!user.inventory) user.inventory = new Map();
        
        const currentCount = user.inventory.get(itemKey) || 0;
        user.inventory.set(itemKey, currentCount + amount);
        await user.save();
        return user;
    },

    /**
     * Removes an item from a user's inventory
     * @param {string} userId The discord user ID
     * @param {string} itemKey The key of the item from ItemsConfig
     * @param {number} amount Amount of items to remove
     * @returns {Promise<EconomyUser>}
     */
    async removeItem(userId, itemKey, amount = 1) {
        const user = await this.getUser(userId);
        if (!user.inventory) return user;

        const currentCount = user.inventory.get(itemKey) || 0;
        if (currentCount <= amount) {
            user.inventory.delete(itemKey);
        } else {
            user.inventory.set(itemKey, currentCount - amount);
        }
        await user.save();
        return user;
    },

    /**
     * Handles a user's death by wiping their wallet and stripping their inventory
     * conditionally based on EconomyConfig
     * @param {string} userId The discord user ID
     * @returns {Promise<{user: EconomyUser, saved: boolean, message: string}>}
     */
    async handleDeath(userId) {
        const user = await this.getUser(userId);
        
        // Check for life-saver
        if (user.inventory && user.inventory.get('life-saver') > 0) {
            const currentCount = user.inventory.get('life-saver');
            if (currentCount === 1) {
                user.inventory.delete('life-saver');
            } else {
                user.inventory.set('life-saver', currentCount - 1);
            }
            await user.save();
            return { 
                user, 
                saved: true, 
                message: "> **You died, but your 💝 Life Saver saved you!**" 
            };
        }

        // Wipe wallet completely
        user.wallet = 0;

        // Wipe inventory, protecting items based on config
        if (user.inventory) {
            const protectedWeight = EconomyConfig.deathSettings.keepItemsUnderWeight;
            const keepRareItems = EconomyConfig.deathSettings.keepRareItems;

            for (const [itemKey, count] of user.inventory.entries()) {
                const itemData = EconomyConfig.items[itemKey];
                
                // If item doesn't exist in config anymore, just wipe it
                if (!itemData) {
                    user.inventory.delete(itemKey);
                    continue;
                }

                // If keeping rare items is enabled and the dropWeight is sufficiently low (rare)
                if (keepRareItems && (itemData.dropWeight || 100) <= protectedWeight) {
                    continue; // Preserve this item
                } else {
                    user.inventory.delete(itemKey); // Wipe it
                }
            }
        }

        await user.save();
        return { 
            user, 
            saved: false, 
            message: "> **You were killed! Your wallet and inventory were wiped.**" 
        };
    },

    /**
     * Gets global economy settings, creating them if missing
     * @returns {Promise<EconomySettings>}
     */
    async getSettings() {
        let settings = await EconomySettings.findOne({ id: 'global' });
        if (!settings) {
            settings = new EconomySettings();
            await settings.save();
            return settings;
        }

        let changed = false;
        const now = new Date();
        
        if (settings.moneyExpiry && now > settings.moneyExpiry) {
            settings.moneyMultiplier = 1.0;
            settings.moneyExpiry = null;
            changed = true;
        }
        if (settings.luckExpiry && now > settings.luckExpiry) {
            settings.luckMultiplier = 1.0;
            settings.luckExpiry = null;
            changed = true;
        }
        if (settings.cooldownExpiry && now > settings.cooldownExpiry) {
            settings.cooldownMultiplier = 1.0;
            settings.cooldownExpiry = null;
            changed = true;
        }

        if (changed) {
            await settings.save();
        }

        return settings;
    },

    /**
     * Calculates the final money reward and multiplier breakdown
     * @param {number} baseAmount The raw unmultiplied amount
     * @param {string} userId The discord user ID to apply individual multipliers
     * @returns {Promise<{finalAmount: number, multiplier: number, bonus: number}>}
     */
    async calculateMoney(baseAmount, userId) {
        const settings = await this.getSettings();
        const user = userId ? await this.getUser(userId) : { moneyMultiplier: 1.0 };
        
        // Additive stacking: Global 1.5x + User 1.5x = 2.0x (since base is 1.0)
        let globalMoney = settings.moneyMultiplier !== undefined ? settings.moneyMultiplier : 1.0;
        let userMoney = user.moneyMultiplier !== undefined ? user.moneyMultiplier : 1.0;
        let multiplier = Math.max(0, globalMoney + (userMoney - 1.0));
        const finalAmount = Math.floor(baseAmount * multiplier);
        
        return {
            finalAmount,
            multiplier,
            bonus: finalAmount - baseAmount
        };
    },

    /**
     * Calculates the final success chance based on luck multiplier
     * @param {number} baseSuccessChance The raw unmultiplied success chance (e.g. 0.4 for 40%)
     * @param {string} userId The discord user ID to apply individual multipliers
     * @returns {Promise<{chance: number, roll: number, isSuccess: boolean, multiplier: number}>}
     */
    async calculateLuckRoll(baseSuccessChance, userId) {
        const settings = await this.getSettings();
        const user = userId ? await this.getUser(userId) : { luckMultiplier: 1.0 };
        
        let globalLuck = settings.luckMultiplier !== undefined ? settings.luckMultiplier : 1.0;
        let userLuck = user.luckMultiplier !== undefined ? user.luckMultiplier : 1.0;
        
        let rawMulti = globalLuck + (userLuck - 1.0);
        let multiplier;
        
        if (rawMulti >= 0.05) {
            multiplier = rawMulti;
        } else {
            // Exponential decay for severe debuffs, so -2.5 is rare but possible, while -999999 is strictly 0.
            multiplier = Math.max(0, 0.05 * Math.exp(rawMulti - 0.05));
        }
        
        const chance = baseSuccessChance * multiplier;
        const roll = Math.random();
        
        return {
            chance,
            roll,
            isSuccess: roll <= chance,
            multiplier
        };
    },

    /**
     * Extracts the icon URL from the configured currency symbol if it's a custom Discord emoji.
     * @returns {string|null}
     */
    getCurrencyIconURL() {
        const match = EconomyConfig.currencySymbol.match(/<a?:.+?:(\d+)>/);
        if (match) {
            const isAnimated = EconomyConfig.currencySymbol.startsWith('<a:');
            return `https://cdn.discordapp.com/emojis/${match[1]}.${isAnimated ? 'gif' : 'png'}`;
        }
        return null;
    },

    /**
     * Gets a guild's settings from the database
     * @param {string} guildId 
     * @returns {Promise<GuildSettings>}
     */
    async getGuildSettings(guildId) {
        let settings = await GuildSettings.findOne({ guildId });
        if (!settings) {
            settings = new GuildSettings({ guildId });
            await settings.save();
        }
        return settings;
    },

    /**
     * Posts a news event to the configured guild news channel, if set
     * @param {Guild} guild Discord Guild object
     * @param {string} eventText The text to display in the news embed
     * @param {string} embedColor Color for the embed
     * @param {string} rawContent Optional content to send outside the embed (e.g. pings)
     */
    async postNewsEvent(guild, eventText, embedColor = '#2b2d31', rawContent = null) {
        try {
            if (!guild) return;
            const settings = await this.getGuildSettings(guild.id);
            if (!settings.newsChannelId) return;

            const channel = await guild.channels.fetch(settings.newsChannelId).catch(() => null);
            if (!channel) return;

            const formattedText = eventText.replace(/^#\s/, '## ');
            const embed = new EmbedBuilder()
                .setDescription(`# 🚨 BREAKING NEWS 🚨\n\n${formattedText}`)
                .setColor(embedColor)
                .setTimestamp();

            const messagePayload = { embeds: [embed] };
            if (rawContent) {
                messagePayload.content = rawContent;
            }

            await channel.send(messagePayload);
        } catch (error) {
            console.error('Failed to post news event:', error);
        }
    },

    /**
     * Safely attempts to send a Direct Message to a user
     * @param {User|GuildMember} user The target user or member
     * @param {Object|string} payload The message payload
     */
    async dmUser(user, payload) {
        try {
            await user.send(payload);
            return true;
        } catch (error) {
            return false;
        }
    }
};
