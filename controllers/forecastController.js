const db = require('../config/database');
const { buildForecast, computeStockoutRisk } = require('../services/forecastService');
const { runProphetForecast } = require('../services/prophetService');

const ALLOWED_DAYS = new Set([7, 15, 30]);
const DEFAULT_MIN_DAILY_DEMAND = Number(process.env.FORECAST_MIN_DAILY_DEMAND || 0.25);
const DEFAULT_STOCKOUT_THRESHOLD_DAYS = Number(process.env.PREDICTED_STOCKOUT_DAYS_THRESHOLD || 30);

function parseDays(value) {
    const parsed = Number(value || 30);
    if (!Number.isInteger(parsed) || !ALLOWED_DAYS.has(parsed)) {
        return null;
    }
    return parsed;
}

function normalizeStockoutRisk(risk, days) {
    const thresholdDays = Math.max(1, Math.min(days, DEFAULT_STOCKOUT_THRESHOLD_DAYS));
    const averageDemand = Number(risk.average_daily_demand || 0);
    const estimatedDays = Number(risk.estimated_days_to_stockout || 0);

    const atRisk = Boolean(
        averageDemand >= DEFAULT_MIN_DAILY_DEMAND
        && risk.estimated_days_to_stockout !== null
        && estimatedDays <= thresholdDays
    );

    return {
        ...risk,
        at_risk: atRisk,
        applied_days_threshold: thresholdDays,
        min_daily_demand_threshold: DEFAULT_MIN_DAILY_DEMAND,
    };
}

async function upsertPredictedStockoutAlert(product, risk, horizonDays) {
    const [rows] = await db.query(
        `SELECT alert_id
         FROM alerts
         WHERE product_id = ?
           AND alert_type = 'predicted_stockout'
           AND is_resolved = FALSE
         LIMIT 1`,
        [product.product_id]
    );

    if (!risk.at_risk) {
        if (rows.length > 0) {
            await db.query(
                `UPDATE alerts
                 SET is_resolved = TRUE,
                     resolved_at = NOW(),
                     is_read = FALSE
                 WHERE alert_id = ?`,
                [rows[0].alert_id]
            );
        }
        return;
    }

    let severity = 'medium';
    if (risk.estimated_days_to_stockout <= 7) {
        severity = 'critical';
    } else if (risk.estimated_days_to_stockout <= 15) {
        severity = 'high';
    }
    const message = `${product.product_name} may stock out in ${risk.estimated_days_to_stockout} days (forecast window: ${horizonDays} days)`;

    if (rows.length > 0) {
        await db.query(
            `UPDATE alerts
             SET message = ?, severity = ?, is_read = FALSE
             WHERE alert_id = ?`,
            [message, severity, rows[0].alert_id]
        );
        return;
    }

    await db.query(
        `INSERT INTO alerts (product_id, alert_type, message, severity, is_read, is_resolved)
         VALUES (?, 'predicted_stockout', ?, ?, FALSE, FALSE)`,
        [product.product_id, message, severity]
    );
}

async function getDemandForecast(req, res) {
    try {
        const productId = Number(req.params.product_id);
        const days = parseDays(req.query.days);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: 'product_id must be a positive integer',
            });
        }

        if (!days) {
            return res.status(400).json({
                success: false,
                message: 'days must be one of: 7, 15, 30',
            });
        }

        const [productRows] = await db.query(
            `SELECT product_id, sku, product_name, current_stock, reorder_level
             FROM products
             WHERE product_id = ? AND is_active = TRUE
             LIMIT 1`,
            [productId]
        );

        if (productRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        const product = productRows[0];

        const [historyRows] = await db.query(
            `SELECT sale_date, SUM(quantity_sold) AS quantity_sold
             FROM sales_data
             WHERE product_id = ?
             GROUP BY sale_date
             ORDER BY sale_date ASC`,
            [productId]
        );

        let forecastResult;
        let modelUsed = 'statistical';

        try {
            forecastResult = await runProphetForecast(productId, days);
            modelUsed = 'prophet';
        } catch (prophetError) {
            console.warn('Prophet unavailable, falling back to statistical model:', prophetError.message);
            forecastResult = buildForecast(historyRows, days);
        }

        const forecast = forecastResult;
        const stockoutRisk = normalizeStockoutRisk(
            computeStockoutRisk(Number(product.current_stock || 0), forecast.predictions),
            days
        );

        await db.query(
            'DELETE FROM forecasts WHERE product_id = ? AND forecast_date >= CURDATE()',
            [productId]
        );

        if (forecast.predictions.length > 0) {
            await db.query(
                `INSERT INTO forecasts (product_id, forecast_date, predicted_demand, confidence_lower, confidence_upper, model_accuracy)
                 VALUES ${forecast.predictions.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`,
                forecast.predictions.flatMap((prediction) => [
                    productId,
                    prediction.forecast_date,
                    prediction.predicted_demand,
                    prediction.confidence_lower,
                    prediction.confidence_upper,
                    prediction.model_accuracy,
                ])
            );
        }

        await upsertPredictedStockoutAlert(product, stockoutRisk, days);

        return res.json({
            success: true,
            message: 'Demand forecast generated successfully ✅',
            data: {
                product: {
                    product_id: product.product_id,
                    sku: product.sku,
                    product_name: product.product_name,
                    current_stock: Number(product.current_stock || 0),
                    reorder_level: Number(product.reorder_level || 0),
                },
                horizon_days: days,
                model_used: modelUsed,
                model_accuracy: forecast.model_accuracy,
                average_daily_demand: forecast.average_daily_demand,
                stockout_risk: stockoutRisk,
                predictions: forecast.predictions,
            },
        });
    } catch (error) {
        console.error('Get demand forecast error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message,
        });
    }
}

async function getForecastSummary(req, res) {
    try {
        const days = parseDays(req.query.days);

        if (!days) {
            return res.status(400).json({
                success: false,
                message: 'days must be one of: 7, 15, 30',
            });
        }

        const [productRows] = await db.query(
            `SELECT product_id, sku, product_name, current_stock
             FROM products
             WHERE is_active = TRUE
             ORDER BY product_name ASC`
        );

        const summary = [];

        for (const product of productRows) {
            const [historyRows] = await db.query(
                `SELECT sale_date, SUM(quantity_sold) AS quantity_sold
                 FROM sales_data
                 WHERE product_id = ?
                 GROUP BY sale_date
                 ORDER BY sale_date ASC`,
                [product.product_id]
            );

            const forecast = buildForecast(historyRows, days);
            const stockoutRisk = normalizeStockoutRisk(
                computeStockoutRisk(Number(product.current_stock || 0), forecast.predictions),
                days
            );
            const totalPredictedDemand = forecast.predictions.reduce(
                (sum, prediction) => sum + Number(prediction.predicted_demand || 0),
                0
            );

            summary.push({
                product_id: product.product_id,
                sku: product.sku,
                product_name: product.product_name,
                current_stock: Number(product.current_stock || 0),
                total_predicted_demand: Number(totalPredictedDemand.toFixed(2)),
                average_daily_demand: forecast.average_daily_demand,
                model_accuracy: forecast.model_accuracy,
                stockout_risk: stockoutRisk,
            });
        }

        return res.json({
            success: true,
            message: 'Forecast summary fetched successfully ✅',
            data: summary,
            filters: {
                days,
            },
        });
    } catch (error) {
        console.error('Get forecast summary error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message,
        });
    }
}

async function refreshPredictedStockoutAlerts(req, res) {
    try {
        const days = parseDays(req.body?.days || req.query.days || 30);

        if (!days) {
            return res.status(400).json({
                success: false,
                message: 'days must be one of: 7, 15, 30',
            });
        }

        const [productRows] = await db.query(
            `SELECT product_id, sku, product_name, current_stock, reorder_level
             FROM products
             WHERE is_active = TRUE`
        );

        let atRiskCount = 0;

        for (const product of productRows) {
            const [historyRows] = await db.query(
                `SELECT sale_date, SUM(quantity_sold) AS quantity_sold
                 FROM sales_data
                 WHERE product_id = ?
                 GROUP BY sale_date
                 ORDER BY sale_date ASC`,
                [product.product_id]
            );

            const forecast = buildForecast(historyRows, days);
            const risk = normalizeStockoutRisk(
                computeStockoutRisk(Number(product.current_stock || 0), forecast.predictions),
                days
            );

            if (risk.at_risk) {
                atRiskCount += 1;
            }

            await upsertPredictedStockoutAlert(product, risk, days);
        }

        return res.json({
            success: true,
            message: 'Predicted stockout alerts refreshed successfully ✅',
            data: {
                scanned_products: productRows.length,
                at_risk_products: atRiskCount,
                horizon_days: days,
            },
        });
    } catch (error) {
        console.error('Refresh predicted stockout alerts error:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error occurred',
            error: error.message,
        });
    }
}

module.exports = {
    getDemandForecast,
    getForecastSummary,
    refreshPredictedStockoutAlerts,
};
