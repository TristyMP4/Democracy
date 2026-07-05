module.exports = [
    {
        name: "Jacob's Room",
        emoji: "🚪",
        minReward: 100,
        maxReward: 1000,
        possibleItems: ['semi-automatic-pistol', 'wet-willow', 'sock', 'pistol-ammo'],
        successMessages: [
            { message: "You searched Jacob's Room and found **${amount}** hidden under a pile of clothes!", signature: "where's willow?" }, 
            { message: "You bravely entered Jacob's Room and snagged **${amount}** from the desk.", signature: "are you sure it's not monopoly money?" },
            { message: "Jacob was asleep. You crept in and swiped **${amount}**!", signature: "sneaky sneaky" }
        ],
        failMessages: [
            { message: "Jacob caught you and kicked you out. You got nothing.", signature: "you're probably better off", deathChance: 0.05 }, 
            { message: "You searched Jacob's Room but only found empty food wrappers.", signature: "no surprise there", deathChance: 0.01 },
            { message: "It smelled too bad in there, you had to turn back.", signature: "stink bug", deathChance: 0.1 }
        ]
    },
    {
        name: "Porker's Car",
        emoji: "🚗",
        minReward: 100,
        maxReward: 850,
        possibleItems: ['weed', 'crude-oil'],
        successMessages: [
            { message: "You searched Porkies car and found **${amount}**!", signature: "a mediocre amount" }, 
            { message: "You grafted Porkies baby food and sold it for **${amount}**.", signature: "maybe that's why hes always hungry" },
            { message: "You stole Porkies booster seat and sold it for **${amount}**!", signature: "now hope he crashes" }
        ],
        failMessages: [
            { message: "You searched relentlessly but all the doob was smoked already.", signature: "where's dad at", deathChance: 0.02 }, 
            { message: "Porky Pig walked to school today because he was bullied", signature: "just wait till he gets picked up afterschool", deathChance: 0.01 },
            { message: "The smell of doob in the car instantly made you high and you forgot what you were doing.", signature: "try again next time?", deathChance: 0.1 }
        ]
    },
    {
        name: "Old Bunker",
        emoji: "🏚️",
        minReward: 500,
        maxReward: 2500,
        possibleItems: ['thompson', 'semi-automatic-rifle', 'pistol-ammo'],
        successMessages: [
            { message: "You opened a PC in the Old Bunker and found **${amount}**!", signature: "origin slug slammage" }, 
            { message: "You survived the Old Bunker and walked out with **${amount}**.", signature: "make sure theres no mat-49 wallbanger ready to pummel you." }
        ],
        failMessages: [
            { message: "You got slapped by a full Boss Kit trio.", signature: "better luck next time", deathChance: 0.20 }, 
            { message: "The Old Bunker was looted already.", signature: "come back when its your turn", deathChance: 0.05 }
        ]
    },
    {
        name: "Outpost",
        emoji: "⛺",
        minReward: 300,
        maxReward: 1500,
        possibleItems: ['semi-automatic-pistol', 'thompson', 'pistol-ammo'],
        successMessages: [
            { message: "You wandered into Outpost and grafted **${amount}** from someone's recycler.", signature: "ez recycler steal." }, 
            { message: "You pushed a guy away from refinery and sold his low grade for **${amount}**!", signature: "fuck you" }
        ],
        failMessages: [
            { message: "You got your recycler loot robbed", signature: "karma's a bitch", deathChance: 0.05 }, 
            { message: "No one was at the outpost", signature: "loner", deathChance: 0 }
        ]
    },
    {
        name: "Oil Rig",
        emoji: "🛢️",
        minReward: 1000,
        maxReward: 5000,
        possibleItems: ['ak-alpha', 'supply-signal', '556-rifle-ammo', 'pistol-ammo'],
        successMessages: [
            { message: "You fought the heavies at the Oil Rig and claimed **${amount}** from the locked crate!", signature: "Heavy takedown." }, 
            { message: "You sniped the scientists and secured **${amount}** at the Oil Rig.", signature: "Sniper elite." }
        ],
        failMessages: [
            { message: "Heavy scientists slammed you. You stood no chance.", signature: "bot behaviour", deathChance: 0.30 }, 
            { message: "You got countered by the better team", signature: "no crate for you", deathChance: 0.25 }
        ]
    },
    {
        name: "Cargo",
        emoji: "🚢",
        minReward: 800,
        maxReward: 4500,
        possibleItems: ['xm-250', 'collector-armour-rig', 'ak-alpha', 'supply-signal', '762x39-rifle-ammo', '556-rifle-ammo'],
        successMessages: [
            { message: "You boarded the Cargo Ship and sold the components you found for **${amount}**", signature: "Scrap run." }, 
            { message: "You contested Cargo and wiped out competition **${amount}**", signature: "well well well" }
        ],
        failMessages: [
            { message: "You missed the ladder and your boat drove off.", signature: "how the fuck did you miss", deathChance: 0.15 }, 
            { message: "Counters wiped you out.", signature: "Should have held.", deathChance: 0.20 }
        ]
    }
];
