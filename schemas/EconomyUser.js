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
    lastCrime: { type: Date, default: null },
    lastSearch: { type: Date, default: null }
});

module.exports = mongoose.model('EconomyUser', economyUserSchema);
