const ItemsConfig = require('./ItemsConfig.js');
const SearchLocationsConfig = require('./SearchLocationsConfig.js');
const CrimeMessagesConfig = require('./CrimeMessagesConfig.js');

module.exports = {
    embedColor: 0x2b2d31,
    successColor: 0x2ecc71,
    failColor: 0xe74c3c,

    // Icons & Emojis
    ReplyIcon: "<:Reply:1521616973518340097>",
    RefreshIcon: "<:Refresh:1521618279096127488>",
    ForwardArrow: "<:ForwardArrow:1521618281780478012>",
    BackwardArrow: "<:BackArrow:1521618280194900108>",
    LastArrow: "<:LastArrow:1521618284133486792>",
    StartArrow: "<:StartArrow:1521618283034579075>",

    currencySymbol: '<:Scrap:1521924158399971409> ',
    
    // Dictionary of All Items in the Economy System
    items: ItemsConfig,

    searchSettings: {
        // Base probabilities for search outcomes (luck multiplier will boost higher tier outcomes)
        outcomes: {
            moneyAndItem: 0.10, // 10%
            itemOnly: 0.20,     // 20%
            moneyOnly: 0.40,    // 40%
            nothing: 0.30       // 30%
        }
    },
    searchLocations: SearchLocationsConfig,

    // Crime configurations
    crime: {
        successChance: 0.5, // 50% base chance
        minReward: 500,
        maxReward: 5000,
        finePercentage: 0.1, // Lose 10% of wallet on fail
        successMessages: CrimeMessagesConfig.successMessages,
        failMessages: CrimeMessagesConfig.failMessages
    },

    // Rob configurations
    rob: {
        successChance: 0.4, // Base 40% chance of success
        minStealPercentage: 0.05, // Steal at least 5% of target wallet
        maxStealPercentage: 0.15, // Steal up to 15% of target wallet
        finePercentage: 0.1, // Lose 10% of your own wallet on fail
        minimumAmountToRob: 5000,
        cooldown: 300 * 1000 // 5 minutes (300 seconds) to milliseconds * 1000
    }
};
