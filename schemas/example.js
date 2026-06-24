const { Schema, model } = require('mongoose');

let test = new Schema({
    Content: String
});

module.exports = model('testingschema1912323131', test);