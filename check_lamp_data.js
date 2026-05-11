const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkLampData() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('demo');
    const telemetry = db.collection('bwts_iot_telemetry');

    // Get a sample record to see structure
    const sample = await telemetry.findOne({}, { sort: { timestamp: -1 } });

    console.log('=== SAMPLE TELEMETRY RECORD ===');
    console.log('Lamp 1 fields:');
    console.log('- LAMP_01_STATUS:', sample.LAMP_01_STATUS);
    console.log('- LAMP_01_POWER:', sample.LAMP_01_POWER, 'W');
    console.log('- LAMP_01_RUNTIME:', sample.LAMP_01_RUNTIME, 'hours');
    console.log('- LAMP_01_EFFICIENCY:', sample.LAMP_01_EFFICIENCY, '%');

    console.log('\nSystem-level UV:');
    console.log('- UVR_INTENSITY:', sample.UVR_INTENSITY, 'W/m²');
    console.log('- UVR_POWER_OUTPUT:', sample.UVR_POWER_OUTPUT, 'W');

    // Check runtime range
    const pipeline = [
      {
        $group: {
          _id: null,
          minRuntime: { $min: '$LAMP_01_RUNTIME' },
          maxRuntime: { $max: '$LAMP_01_RUNTIME' },
          minEfficiency: { $min: '$LAMP_01_EFFICIENCY' },
          maxEfficiency: { $max: '$LAMP_01_EFFICIENCY' },
          minPower: { $min: '$LAMP_01_POWER' },
          maxPower: { $max: '$LAMP_01_POWER' }
        }
      }
    ];

    const stats = await telemetry.aggregate(pipeline).toArray();
    console.log('\n=== LAMP 01 DATA RANGE ===');
    console.log('Runtime Hours:', stats[0].minRuntime, '-', stats[0].maxRuntime);
    console.log('Efficiency %:', stats[0].minEfficiency.toFixed(1), '-', stats[0].maxEfficiency.toFixed(1));
    console.log('Power W:', stats[0].minPower.toFixed(1), '-', stats[0].maxPower.toFixed(1));

    // Check health scores
    const health = db.collection('bwts_iot_health_scores');
    const healthSample = await health.findOne({}, { sort: { timestamp: -1 } });
    console.log('\n=== HEALTH SCORE STRUCTURE ===');
    console.log('Overall score:', healthSample.overall_score);
    console.log('Components:');
    console.log('  - lamp_health:', healthSample.components.lamp_health);
    console.log('  - uv_health:', healthSample.components.uv_health);

    // Sample 5 records to see runtime progression
    console.log('\n=== LAMP 01 RUNTIME PROGRESSION (Sample) ===');
    const progression = await telemetry.find({})
      .sort({ LAMP_01_RUNTIME: 1 })
      .limit(5)
      .toArray();

    progression.forEach(record => {
      const eff = record.LAMP_01_EFFICIENCY.toFixed(1);
      const pow = record.LAMP_01_POWER.toFixed(0);
      console.log('Runtime: ' + record.LAMP_01_RUNTIME + 'h | Efficiency: ' + eff + '% | Power: ' + pow + 'W');
    });

  } finally {
    await client.close();
  }
}

checkLampData().catch(console.error);
