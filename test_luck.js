const mongoose = require('mongoose');
const EconomyUtils = require('./utils/EconomyUtils.js');
const EconomyConfig = require('./configs/EconomyConfig.js');

async function run() {
    await mongoose.connect('mongodb://127.0.0.1/democracy');
    
    const luckRoll = await EconomyUtils.calculateLuckRoll(1, '1087460016291844156');
    console.log('luckMulti:', luckRoll.multiplier);

    const outcomesConfig = EconomyConfig.searchSettings.outcomes;
    const weights = [
        { type: 'moneyAndItem', weight: outcomesConfig.moneyAndItem * luckRoll.multiplier },
        { type: 'itemOnly', weight: outcomesConfig.itemOnly * luckRoll.multiplier },
        { type: 'moneyOnly', weight: outcomesConfig.moneyOnly * luckRoll.multiplier },
        { type: 'nothing', weight: outcomesConfig.nothing }
    ];

    console.log('weights:', weights);

    const totalWeight = weights.reduce((acc, curr) => acc + curr.weight, 0);
    console.log('totalWeight:', totalWeight);

    let random = Math.random() * totalWeight;
    console.log('random:', random);

    let selectedOutcome = 'nothing';
    for (const w of weights) {
        if (random < w.weight) {
            selectedOutcome = w.type;
            break;
        }
        random -= w.weight;
    }

    console.log('selectedOutcome:', selectedOutcome);
    
    process.exit(0);
}

run();
