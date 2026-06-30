const ItemsConfig = require('./ItemsConfig.js');
const SearchLocationsConfig = require('./SearchLocationsConfig.js');
const CrimeMessagesConfig = require('./CrimeMessagesConfig.js');

module.exports = {
    embedColor: 0x2b2d31,
    successColor: 0x2ecc71,
    failColor: 0xe74c3c,

    currencySymbol: '£',
    currencyCode: 'GBP',

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
    }
};
