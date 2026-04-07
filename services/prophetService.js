const { spawn } = require('node:child_process');
const path = require('node:path');

const PYTHON_SCRIPT = path.join(__dirname, '..', '..', 'python', 'forecast_prophet.py');
const TIMEOUT_MS = 30000;

function runProphetForecast(productId, days) {
    return new Promise((resolve, reject) => {
        const cmd = process.env.PYTHON_CMD || 'python3';
        const child = spawn(cmd, [PYTHON_SCRIPT, String(productId), String(days)], {
            env: { ...process.env },
            timeout: TIMEOUT_MS,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });

        child.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(`Prophet exited ${code}: ${stderr.slice(0, 200)}`));
            }
            try {
                const result = JSON.parse(stdout.trim());
                if (result.error) {
                    return reject(new Error(`Prophet: ${result.error}`));
                }
                return resolve(result);
            } catch {
                return reject(new Error('Failed to parse Prophet output'));
            }
        });

        child.on('error', (e) => reject(new Error(`Cannot start Prophet: ${e.message}`)));
    });
}

module.exports = { runProphetForecast };
