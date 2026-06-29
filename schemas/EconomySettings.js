const mongoose = require('mongoose');

const economySettingsSchema = new mongoose.Schema({
    id: { type: String, default: 'global', unique: true },
    moneyMultiplier: { type: Number, default: 1.0 },
    luckMultiplier: { type: Number, default: 1.0 },
    economyDisabled: { type: Boolean, default: false },
    economyDisabledReason: { type: String, default: 'Maintenance in progress.' }
});

module.exports = mongoose.model('EconomySettings', economySettingsSchema);
