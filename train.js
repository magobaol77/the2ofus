// Allenamento dei pesi dell'automa (Node.js): node train.js [passi] [coppie di partite per passo]
const fs = require('fs'); const vm = require('vm'); const { load } = require('./bot-sim.js');
(async () => {
  const steps = +process.argv[2] || 20, pairs = +process.argv[3] || 6;
  const ctx = load();
  let champ = Object.assign({}, ctx.BOT_DEFAULT_WEIGHTS, ctx.BOT_TRAINED_WEIGHTS);
  for (let s = 1; s <= steps; s++) {
    const t0 = Date.now();
    const r = await ctx.simTrainStep(champ, { pairs, sigma: 0.3, threshold: 0.6 });
    const ch = Object.keys(r.chall).filter(k => r.chall[k] !== champ[k]).map(k => k + ' ' + champ[k] + '→' + r.chall[k]).join(', ');
    console.log('passo ' + s + ': sfidante vince ' + Math.round(r.rate * 100) + '%, diff media ' + r.avgDiff.toFixed(1) + (r.accepted ? '  ACCETTATO' : '') + '  [' + ch + '] ' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
    if (r.accepted) {
      champ = r.chall;
      fs.writeFileSync(__dirname + '/bot-weights.js', "// Pesi allenati dell'automa (generati da train.js / simulatore). Vuoto = pesi di base.\nvar BOT_TRAINED_WEIGHTS = " + JSON.stringify(champ, null, 1) + ";\n");
    }
  }
})();
