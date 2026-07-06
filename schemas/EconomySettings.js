const mongoose = require('mongoose');

const economySettingsSchema = new mongoose.Schema({
    id: { type: String, default: 'global', unique: true },
    moneyMultiplier: { type: Number, default: 1.0 },
    luckMultiplier: { type: Number, default: 1.0 },
    cooldownMultiplier: { type: Number, default: 1.0 },
    moneyExpiry: { type: Date, default: null },
    luckExpiry: { type: Date, default: null },
    cooldownExpiry: { type: Date, default: null }
});

module.exports = mongoose.model('EconomySettings', economySettingsSchema);
