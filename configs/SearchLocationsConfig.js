module.exports = [
    {
        name: "Jacob's Room",
        emoji: "🚪",
        minReward: 100,
        maxReward: 1000,
        possibleItems: ['semi-automatic-pistol', 'wet-willow', 'sock'],
        successMessages: [
            { message: "You searched Jacob's Room and found **${amount}** hidden under a pile of clothes!", signature: "where's willow?" }, 
            { message: "You bravely entered Jacob's Room and snagged **${amount}** from the desk.", signature: "are you sure it's not monopoly money?" },
            { message: "Jacob was asleep. You crept in and swiped **${amount}**!", signature: "sneaky sneaky" }
        ],
        failMessages: [
            { message: "Jacob caught you and kicked you out. You got nothing.", signature: "you're probably better off" }, 
            { message: "You searched Jacob's Room but only found empty food wrappers.", signature: "no surprise there" },
            { message: "It smelled too bad in there, you had to turn back.", signature: "stink bug" }
        ]
    },
    {
        name: "Old Bunker",
        emoji: "🏚️",
        minReward: 500,
        maxReward: 2500,
        possibleItems: ['thompson', 'semi-automatic-rifle'],
        successMessages: [
            { message: "You opened a PC in the Old Bunker and found **${amount}**!", signature: "origin slug slammage" }, 
            { message: "You survived the Old Bunker and walked out with **${amount}**.", signature: "make sure theres no mat-49 wallbanger ready to pummel you." }
        ],
        failMessages: [
            { message: "You got slapped by a full Boss Kit trio.", signature: "better luck next time" }, 
            { message: "The Old Bunker was looted already.", signature: "come back when its your turn" }
        ]
    },
    {
        name: "Outpost",
        emoji: "⛺",
        minReward: 300,
        maxReward: 1500,
        possibleItems: ['semi-automatic-pistol', 'thompson'],
        successMessages: [
            { message: "You wandered into Outpost and grafted **${amount}** from someone's recycler.", signature: "ez recycler steal." }, 
            { message: "You pushed a guy away from refinery and sold his low grade for **${amount}**!", signature: "fuck you" }
        ],
        failMessages: [
            { message: "You got your recycler loot robbed", signature: "karma's a bitch" }, 
            { message: "No one was at the outpost", signature: "loner" }
        ]
    },
    {
        name: "Oil Rig",
        emoji: "🛢️",
        minReward: 1000,
        maxReward: 5000,
        possibleItems: ['ak-alpha', 'supply-signal'],
        successMessages: [
            { message: "You fought the heavies at the Oil Rig and claimed **${amount}** from the locked crate!", signature: "Heavy takedown." }, 
            { message: "You sniped the scientists and secured **${amount}** at the Oil Rig.", signature: "Sniper elite." }
        ],
        failMessages: [
            { message: "Heavy scientists slammed you. You stood no chance.", signature: "bot behaviour" }, 
            { message: "You got countered by the better team", signature: "no crate for you" }
        ]
    },
    {
        name: "Cargo",
        emoji: "🚢",
        minReward: 800,
        maxReward: 4500,
        possibleItems: ['xm-250', 'collector-armour-rig', 'ak-alpha', 'supply-signal'],
        successMessages: [
            { message: "You boarded the Cargo Ship and sold the components you found for **${amount}**", signature: "Scrap run." }, 
            { message: "You contested Cargo and wiped out competition **${amount}**", signature: "well well well" }
        ],
        failMessages: [
            { message: "You missed the ladder and your boat drove off.", signature: "how the fuck did you miss" }, 
            { message: "Counters wiped you out.", signature: "Should have held." }
        ]
    }
];
