const { Schema, model } = require('mongoose');

const cooldownSchema = new Schema({
    userId: {
        type: String,
        required: true
    },
    commandName: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
});

cooldownSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

module.exports = model('Cooldown', cooldownSchema);