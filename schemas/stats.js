const { Schema, model } = require('mongoose');

const statSchema = new Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },

    votemutes: {
        initiated: { type: Number, default: 0 },
        passed: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        received: { type: Number, default: 0 }
    },

    votekicks: {
        initiated: { type: Number, default: 0 },
        passed: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        received: { type: Number, default: 0 }
    }
});

module.exports = model('Stat', statSchema);