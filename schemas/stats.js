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
        received: { type: Number, default: 0 },

        history: [
            {
                reason: {
                    type: String,
                    default: 'No reason provided'
                },

                duration: {
                    type: Number,
                    default: 0
                },

                initiatedBy: {
                    type: String
                },

                date: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },

    votekicks: {
        initiated: { type: Number, default: 0 },
        passed: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },
        received: { type: Number, default: 0 },

        history: [
            {
                reason: {
                    type: String,
                    default: 'No reason provided'
                },

                initiatedBy: {
                    type: String
                },

                date: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },

    voteskips: {
        initiated: { type: Number, default: 0 },
        passed: { type: Number, default: 0 },
        failed: { type: Number, default: 0 },

        history: [
            {
                trackTitle: {
                    type: String,
                    default: 'Unknown track'
                },

                initiatedBy: {
                    type: String
                },

                date: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    }
});

module.exports = model('Stat', statSchema);