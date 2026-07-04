const mongoose = require('mongoose');

const economyUserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    wallet: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    inventory: { 
        type: Map, 
        of: Number, 
        default: {} 
    },
    lastDaily: { type: Date, default: null },
    lastSearch: { type: Date, default: null },
    lastCrime: { type: Date, default: null },
    luckMultiplier: { type: Number, default: 1.0 },
    luckExpiry: { type: Date, default: null },
    moneyMultiplier: { type: Number, default: 1.0 },
    moneyExpiry: { type: Date, default: null },
    cooldownMultiplier: { type: Number, default: 1.0 },
    cooldownExpiry: { type: Date, default: null },
    
    // Jobs System
    currentJob: { type: String, default: null },
    totalShiftsWorked: { type: Number, default: 0 },
    lastShift: { type: Date, default: null },
    jobApplyCooldown: { type: Date, default: null }
});

module.exports = mongoose.model('EconomyUser', economyUserSchema);
