const ItemsConfig = require('./ItemsConfig.js');
const SearchLocationsConfig = require('./SearchLocationsConfig.js');
const CrimeMessagesConfig = require('./CrimeMessagesConfig.js');
const JobsConfig = require('./JobsConfig.js');

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

    // Dictionary of All Jobs in the Economy System
    jobs: JobsConfig,

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
        maxFine: 20000, // Cap the fine at 20k
        successMessages: CrimeMessagesConfig.successMessages,
        failMessages: CrimeMessagesConfig.failMessages
    },

    // Rob configurations
    rob: {
        successChance: 0.4, // Base 40% chance of success
        minStealPercentage: 0.05, // Steal at least 5% of target wallet
        maxStealPercentage: 0.25, // Steal up to 25% of target wallet
        finePercentage: 0.1, // Lose 10% of your own wallet on fail
        maxFine: 20000, // Cap the fine at 20k
        minimumAmountToRob: 5000,
        cooldown: 300 * 1000 // 5 minutes (300 seconds) to milliseconds * 1000
    },

    // BankRob configurations
    bankrob: {
        successChance: 0.4, // Base 40% chance of success
        minStealPercentage: 0.05, // Steal at least 5% of target bank
        maxStealPercentage: 0.10, // Steal up to 10% of target bank
        finePercentage: 0.05, // Lose 5% of your own bank/wallet on fail
        minTargetBank: 10000, // Target must have at least 10,000 in bank
        minBalanceToJoin: 5000, // Participants must have at least 5,000 in bank or wallet
        cooldown: 7200 * 1000 // 2 hours (7200 seconds)
    },

    // Death System settings
    deathSettings: {
        keepRareItems: true, // Whether rare items are kept upon death
        keepItemsUnderWeight: 4 // Items with a dropWeight <= this value are kept when you die
    },

    // Gambling configurations
    gambling: {
        wheel: {
            gifUrl: 'https://c.tenor.com/OGvOzcBHLjcAAAAd/tenor.gif',
            slots: [
                { number: 1, weight: 24, emoji: '🟨' },
                { number: 3, weight: 10, emoji: '🟩' },
                { number: 5, weight: 8, emoji: '🟦' },
                { number: 10, weight: 4, emoji: '🟥' },
                { number: 20, weight: 2, emoji: '🟪' }
            ]
        },
        blackjack: {
            dealerHitSoft17: true, // Standard rule
            dealerMaxScore: 17, // Dealer cannot exceed this score (unless they bust)
            multiplayerJoinTime: 30000 // 30 seconds to join
        }
    }
};
