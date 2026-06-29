const mongoose = require('mongoose');

const joinToCreateSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    setupChannelId: { type: String, required: true },
    categoryId: { type: String, required: true },
    createdChannels: { type: [String], default: [] }
});

module.exports = mongoose.model('JoinToCreate', joinToCreateSchema);
