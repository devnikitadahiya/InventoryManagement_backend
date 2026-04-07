const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const {
    generateDynamicSeedDataset,
    writeSqlSeedFile,
    seedDynamicSampleData,
} = require('../config/seedGenerator');

function getArgValue(flag, defaultValue = null) {
    const index = process.argv.findIndex((arg) => arg === flag || arg.startsWith(`${flag}=`));
    if (index === -1) return defaultValue;

    const withEquals = process.argv[index];
    if (withEquals.includes('=')) {
        return withEquals.split('=').slice(1).join('=');
    }

    return process.argv[index + 1] || defaultValue;
}

function hasFlag(flag) {
    return process.argv.includes(flag);
}

async function main() {
    const profile = (getArgValue('--profile', 'small') || 'small').toLowerCase();
    const seed = getArgValue('--seed', null);
    const outputDirectory = getArgValue('--out', path.join(__dirname, '..', 'generated'));
    const fileName = getArgValue('--file', `sample-data.dynamic.${Date.now()}.sql`);
    const shouldApply = hasFlag('--apply');

    if (!shouldApply) {
        const dataset = generateDynamicSeedDataset({ profile, seed });
        const sqlFilePath = await writeSqlSeedFile(dataset, {
            outputDirectory,
            fileName,
        });

        console.log(`✅ Dynamic SQL seed file generated: ${sqlFilePath}`);
        console.log(`📦 Profile: ${profile}`);
        if (seed !== null) {
            console.log(`🎯 Deterministic seed: ${seed}`);
        }
        console.log(`Products: ${dataset.products.length} | Transactions: ${dataset.transactions.length}`);
        return;
    }

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306,
        database: process.env.DB_NAME || 'inventory_management',
    });

    try {
        const result = await seedDynamicSampleData(connection, {
            profile,
            seed,
            outputDirectory,
            fileName,
            exportSql: true,
        });

        console.log('✅ Dynamic sample data seeded into database');
        console.log(`📄 SQL export: ${result.sqlFilePath}`);
        console.log(`📊 Seed summary: ${JSON.stringify(result.summary)}`);
        if (seed !== null) {
            console.log(`🎯 Deterministic seed: ${seed}`);
        }
    } finally {
        await connection.end();
    }
}

main().catch((error) => {
    console.error('❌ Dynamic sample data generation failed:', error.message);
    process.exitCode = 1;
});
