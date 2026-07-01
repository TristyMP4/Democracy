const mongoose = require('mongoose');

const globalSettingsSchema = new mongoose.Schema({
    id: { type: String, default: 'global', unique: true },
    economyDisabled: { type: Boolean, default: false },
    economyDisabledReason: { type: String, default: 'Maintenance in progress.' },
    democracyDisabled: { type: Boolean, default: false },
    democracyDisabledReason: { type: String, default: 'Maintenance in progress.' }
});

module.exports = mongoose.model('GlobalSettings', globalSettingsSchema);
