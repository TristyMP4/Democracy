module.exports = {
    'ak-alpha': {
        name: 'AK-Alpha',
        description: 'A powerful assault rifle crafted from modern polymers. - High Fire Rate',
        emoji: '<:AK109Alpha:1521922025336082576>',
        ammo: ["762x39-rifle-ammo"], 
        damagePercentage: 0.55,
        durabilityPercentage: 0.50,
        price: 50000,
        sellPrice: 10000,
        dropWeight: 10, // Very Rare
        usable: true,
        sellable: true
    },
    'xm-250': {
        name: 'XM-250',
        description: 'Devastating heavy machine gun, tears through anything you throw its way. - Dropped by the Collector.',
        emoji: '<:XM250:1521922031241789510>', 
        ammo: ["762x39-rifle-ammo"], 
        damagePercentage: 0.7,
        durabilityPercentage: 0.45,
        price: 85000,
        dropWeight: 3, // Legendary
        usable: true,
        sellable: true
    },
    'collector-armour-rig': {
        name: 'Collector Armour Rig',
        description: 'A heavy duty chest-rig belonging to the Collector.',
        emoji: '<:CollectorRig:1521922849898762310>', 
        price: 65000,
        dropWeight: 3, // Legendary
        sellable: true
    },
    'thompson': {
        name: 'Thompson',
        description: 'A mid tier SMG that is a reliable choice in a gunfight.',
        emoji: '<:Thompson:1521922029790433525>',
        ammo: ["pistol-ammo"], 
        damagePercentage: 0.40,
        durabilityPercentage: 0.40,
        price: 20000,
        sellPrice: 8500,
        dropWeight: 20, // Rare
        usable: true,
        sellable: true
    },
    'semi-automatic-pistol': {
        name: 'Semi Automatic Pistol',
        description: 'A reliable handgun that can open the door to a snowball.',
        emoji: '<:SemiAutomaticPistol:1521922027013931009>',
        ammo: ["pistol-ammo"], 
        damagePercentage: 0.30,
        durabilityPercentage: 0.20,
        price: 3000,
        sellPrice: 2000, 
        dropWeight: 65, // Common
        usable: true,
        sellable: true
    },
    'semi-automatic-rifle': {
        name: 'Semi Automatic Rifle',
        description: 'Medium damaging semi rifle chambered in 5.56',
        emoji: '<:SemiAutomaticRifle:1521922028368826398>',
        ammo: ["556-rifle-ammo"], 
        damagePercentage: 0.45,
        durabilityPercentage: 0.35,
        price: 15000,
        dropWeight: 30, // Rare
        shop: true,
        usable: true,
        sellable: true
    },
    'supply-signal': {
        name: 'Supply Signal',
        description: 'Call in a supply drop. Use this item to receive 1-3 random items!',
        emoji: '<:SupplySignal:1521922411153326120>', 
        price: 850000,
        sellPrice: 50000,
        dropWeight: 3, // Epic
        usable: true,
        sellable: true
    },
    '556-rifle-ammo': {
        name: '5.56 Rifle Ammo',
        description: 'Ammunition for medium caliber rifles.',
        emoji: '<:556_Rifle:1523347950825246741>', 
        price: 850000,
        sellPrice: 50000,
        dropWeight: 3, // Epic
        usable: false,
        sellable: true
    },
    '762x39-rifle-ammo': {
        name: '7.62x39 Rifle Ammo',
        description: 'Ammunition for higher caliber rifles.',
        emoji: '<:762x39_Rifle:1523348831004262490>', 
        price: 850000,
        sellPrice: 50000,
        dropWeight: 3, // Epic
        usable: false,
        sellable: true
    },
    'pistol-ammo': {
        name: '9x19 Pistol Ammo',
        description: 'Ammunition for higher caliber rifles.',
        emoji: '<:Pistol_Ammo:1523350997202763806>', 
        price: 850000,
        sellPrice: 50000,
        dropWeight: 3, // Epic
        usable: false,
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
    },
    'sock': {
        name: "Sock",
        description: "A damp wet sock..",
        emoji: '🧦', 
        price: 850,
        dropWeight: 40, // Uncommon
        usable: false,
        sellable: true
    },
    'weed': {
        name: "Weed",
        description: "A small tuft of weed ready. Smoking it seems to bring a lucky reward..",
        emoji: '<:WeedDoob:1521922663705215126>', 
        price: 50000,
        sellPrice: 7500,
        dropWeight: 50, // Relatively Common
        usable: true,
        sellable: true
    },
    'crude-oil': {
        name: "Crude Oil",
        description: "A barrel of high quality oil.",
        emoji: '🛢️', 
        price: 8500,
        dropWeight: 45, // Uncommon
        usable: false,
        sellable: true
    },
    'green-keycard': {
        name: "Green Keycard",
        description: "A keycard for old bunker that reaps many rewards.",
        emoji: '<:Green_Keycard:1521954128589357127>', 
        price: 500000,
        sellPrice: 25000,
        dropWeight: 8, // Epic
        shop: true,
        usable: true,
        sellable: true
    },
    'purple-keycard': {
        name: "Purple Keycard",
        description: "A high tier keycard that brings great riches.",
        emoji: '<:Purple_Keycard:1521954129889591356>', 
        price: 7500000,
        sellPrice: 150000,
        dropWeight: 6, // Epic
        usable: true,
        sellable: true
    },
    'red-keycard': {
        name: "Red Keycard",
        description: "An exotic tier keycard that brings all you could want.",
        emoji: '<:Red_Keycard:1521956783009169530>', 
        price: 1500000,
        sellPrice: 375000,
        dropWeight: 1, // Exotic
        usable: true,
        sellable: true
    },
    'life-saver': {
        name: "Life Saver",
        description: "Saves your life in the event of a death.",
        emoji: '💝', 
        price: 250000,
        sellPrice: 15000,
        dropWeight: 0, // Unobtainable
        shop: true,
        usable: false,
        sellable: false
    }
};
