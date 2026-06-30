module.exports = {
    embedColor: 0x2b2d31,
    successColor: 0x2ecc71,
    failColor: 0xe74c3c,

    currencySymbol: '£',
    currencyCode: 'GBP',

    // Dictionary of Items in the Economy
    items: {
        'ak-alpha': {
            name: 'AK-Alpha',
            description: 'A powerful assault rifle crafted from modern polymers. - High Fire Rate',
            emoji: '🔫', 
            price: 8500,
            dropWeight: 10, // Very Rare
            sellable: true
        },
        'xm-250': {
            name: 'XM-250',
            description: 'Devastating light machine gun, tears through anything you throw its way. - Dropped by the Collector.',
            emoji: '🔥', 
            price: 30000,
            dropWeight: 3, // Legendary
            sellable: true
        },
        'collector-armour-rig': {
            name: 'Collector Armour Rig',
            description: 'A heavy duty chest-rig belonging to the Collector.',
            emoji: '🦺', 
            price: 30000,
            dropWeight: 3, // Legendary
            sellable: true
        },
        'thompson': {
            name: 'Thompson',
            description: 'A mid tier SMG that is a reliable choice in a gunfight.',
            emoji: '🪵', 
            price: 5500,
            dropWeight: 30, // Rare
            sellable: true
        },
        'semi-automatic-pistol': {
            name: 'Semi Automatic Pistol',
            description: 'A reliable handgun that can open the door to a snowball.',
            emoji: '🤏', 
            price: 2500,
            dropWeight: 100, // Common
            sellable: true
        },
        'semi-automatic-rifle': {
            name: 'Semi Automatic Rifle',
            description: 'High damaging semi rifle chambered in 5.56',
            emoji: '🎯', 
            price: 5000,
            dropWeight: 30, // Rare
            sellable: true
        },
        'supply-signal': {
            name: 'Supply Signal',
            description: 'Call in a supply drop. Use this item to receive 1-3 random items!',
            emoji: '📟', 
            price: 50000,
            dropWeight: 5, // Very Rare, slightly lower than AK
            usable: true,
            sellable: true
        },
        'wet-willow': {
            name: "Wet Willow",
            description: "Wet Willow's dead corpse - Found in the depths of Jacob's Room",
            emoji: '👼', 
            price: 1000000,
            dropWeight: 2, // Exotic
            usable: false,
            sellable: true
        }
    },

    searchSettings: {
        // Base probabilities for search outcomes (luck multiplier will boost higher tier outcomes)
        outcomes: {
            moneyAndItem: 0.10, // 10%
            itemOnly: 0.20,     // 20%
            moneyOnly: 0.40,    // 40%
            nothing: 0.30       // 30%
        }
    },

    // Potential search locations for user choice.
    searchLocations: [
        {
            name: "Jacob's Room",
            emoji: "🚪",
            minReward: 100,
            maxReward: 1000,
            possibleItems: ['semi-automatic-pistol', 'wet-willow'],
            successMessages: [
                "You searched Jacob's Room and found **${amount}** hidden under a pile of clothes!", 
                "You bravely entered Jacob's Room and snagged **${amount}** from the desk.",
                "Jacob was asleep. You crept in and swiped **${amount}**!"
            ],
            failMessages: [
                "Jacob caught you and kicked you out. You got nothing.", 
                "You searched Jacob's Room but only found empty food wrappers.",
                "It smelled too bad in there, you had to turn back."
            ]
        },
        {
            name: "Old Bunker",
            emoji: "🏚️",
            minReward: 500,
            maxReward: 2500,
            possibleItems: ['thompson', 'semi-automatic-rifle'],
            successMessages: [
                "You opened a PC in the Old Bunker and found **${amount}**!", 
                "You survived the Old Bunker and walked out with **${amount}**."
            ],
            failMessages: [
                "You tripped a rusty trap in the Old Bunker and had to run for your life.", 
                "The Old Bunker was completely looted already."
            ]
        },
        {
            name: "Outpost",
            emoji: "⛺",
            minReward: 300,
            maxReward: 1500,
            possibleItems: ['semi-automatic-pistol', 'thompson'],
            successMessages: [
                "You raided the Outpost and secured **${amount}** from the stash.", 
                "You sneaked into the Outpost and grabbed **${amount}**!"
            ],
            failMessages: [
                "The guards at the Outpost spotted you. You barely escaped.", 
                "The Outpost stash was empty."
            ]
        },
        {
            name: "Oil Rig",
            emoji: "🛢️",
            minReward: 1000,
            maxReward: 5000,
            possibleItems: ['ak-alpha', 'supply-signal'],
            successMessages: [
                "You fought the heavies at the Oil Rig and claimed **${amount}** from the locked crate!", 
                "You sniped the scientists and secured **${amount}** at the Oil Rig."
            ],
            failMessages: [
                "Heavy scientists pinned you down. You had to bail from the Oil Rig.", 
                "Another clan countered you at the Oil Rig. You lost everything."
            ]
        },
        {
            name: "Cargo",
            emoji: "🚢",
            minReward: 800,
            maxReward: 4500,
            possibleItems: ['xm-250', 'collector-armour-rig', 'ak-alpha', 'supply-signal'],
            successMessages: [
                "You boarded the Cargo ship and looted **${amount}** from the holds!", 
                "You took out the captain and secured **${amount}** on Cargo."
            ],
            failMessages: [
                "You missed the jump and fell into the ocean trying to board Cargo.", 
                "Counters wiped you on the top deck of Cargo."
            ]
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
            "You stole a luxury vehicle and fenced it for **${amount}**.",
            "You held up the local monument and escaped with **${amount}** in scrap.",
            "You successfully raided a massive clan base and got out with **${amount}**!",
            "You scammed someone in the outpost trading window for **${amount}**."
        ],
        failMessages: [
            "You got caught mid-heist! You paid a fine of **${fine}**.",
            "The cops cornered you. You bribed them with **${fine}** to let you go.",
            "Your crew betrayed you and stole **${fine}** from your cut.",
            "You got roofcamped leaving the monument. You lost **${fine}**.",
            "You tripped a landmine during the raid and dropped **${fine}** in the panic.",
            "The safe zone turrets locked onto you. You dropped **${fine}** while fleeing."
        ]
    }
};
