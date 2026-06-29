module.exports = {
    // Standard embed color for economy commands to keep branding consistent
    embedColor: 0x2b2d31,
    successColor: 0x2ecc71,
    failColor: 0xe74c3c,

    // Pre-loaded items requested by owner
    items: {
        'ak-alpha': {
            name: 'AK-Alpha',
            description: 'A reliable assault rifle for heavy engagements.',
            emoji: '🔫', // Replace with custom emoji like '<:AK_Alpha:123456789>'
            price: 5000,
            rarity: 'Common'
        },
        'xm-250': {
            name: 'XM-250',
            description: 'Next generation light machine gun. Devastating firepower.',
            emoji: '🔥', 
            price: 25000,
            rarity: 'Rare'
        },
        'collector-armour-rig': {
            name: 'Collector Armour Rig',
            description: 'Heavy duty protection for the most dangerous zones.',
            emoji: '🦺', 
            price: 30000,
            rarity: 'Rare'
        },
        'thompson': {
            name: 'Thompson',
            description: 'A classic submachine gun. Fast firing but kicks hard.',
            emoji: '🪵', 
            price: 3000,
            rarity: 'Common'
        },
        'semi-automatic-pistol': {
            name: 'Semi Automatic Pistol',
            description: 'Your basic sidearm. Better than nothing.',
            emoji: '🤏', 
            price: 500,
            rarity: 'Common'
        },
        'semi-automatic-rifle': {
            name: 'Semi Automatic Rifle',
            description: 'Good for keeping your distance from targets.',
            emoji: '🎯', 
            price: 2000,
            rarity: 'Common'
        },
        'supply-signal': {
            name: 'Supply Signal',
            description: 'Call in a supply drop. Use this item to receive 1-3 random items!',
            emoji: '📟', 
            price: 50000,
            rarity: 'Rare',
            usable: true
        }
    },

    // Pre-loaded search locations requested by owner
    searchLocations: [
        {
            name: "Jacob's Room",
            emoji: "🚪",
            successChance: 0.8, // 80% chance of finding money
            minReward: 100,
            maxReward: 1000,
            successMessages: ["You searched Jacob's Room and found **${amount}** hidden under a pile of clothes!", "You bravely entered Jacob's Room and snagged **${amount}** from the desk."],
            failMessages: ["Jacob caught you and kicked you out. You got nothing.", "You searched Jacob's Room but only found empty food wrappers."]
        },
        {
            name: "Old Bunker",
            emoji: "🏚️",
            successChance: 0.6,
            minReward: 500,
            maxReward: 2500,
            successMessages: ["You cracked open a rusted safe in the Old Bunker and found **${amount}**!", "You survived the Old Bunker and walked out with **${amount}**."],
            failMessages: ["You tripped a rusty trap in the Old Bunker and had to run for your life.", "The Old Bunker was completely looted already."]
        },
        {
            name: "Outpost",
            emoji: "⛺",
            successChance: 0.7,
            minReward: 300,
            maxReward: 1500,
            successMessages: ["You raided the Outpost and secured **${amount}** from the stash.", "You sneaked into the Outpost and grabbed **${amount}**!"],
            failMessages: ["The guards at the Outpost spotted you. You barely escaped.", "The Outpost stash was empty."]
        },
        {
            name: "Oil Rig",
            emoji: "🛢️",
            successChance: 0.5,
            minReward: 1000,
            maxReward: 5000, // High risk, high reward
            successMessages: ["You fought the heavies at the Oil Rig and claimed **${amount}** from the locked crate!", "You sniped the scientists and secured **${amount}** at the Oil Rig."],
            failMessages: ["Heavy scientists pinned you down. You had to bail from the Oil Rig.", "Another clan countered you at the Oil Rig. You lost everything."]
        },
        {
            name: "Cargo",
            emoji: "🚢",
            successChance: 0.6,
            minReward: 800,
            maxReward: 4000,
            successMessages: ["You boarded the Cargo ship and looted **${amount}** from the holds!", "You took out the captain and secured **${amount}** on Cargo."],
            failMessages: ["You missed the jump and fell into the ocean trying to board Cargo.", "Counters wiped you on the top deck of Cargo."]
        }
    ],

    // Crime configurations
    crime: {
        successChance: 0.5, // 50% base chance
        minReward: 500,
        maxReward: 5000,
        finePercentage: 0.1, // Lose 10% of wallet on fail
        successMessages: [
            "You robbed a highly secured vault and escaped with **${amount}**!",
            "You successfully hacked the mainframe and transferred **${amount}** to your account.",
            "You stole a luxury vehicle and fenced it for **${amount}**."
        ],
        failMessages: [
            "You got caught mid-heist! You paid a fine of **${fine}**.",
            "The cops cornered you. You bribed them with **${fine}** to let you go.",
            "Your crew betrayed you and stole **${fine}** from your cut."
        ]
    }
};
