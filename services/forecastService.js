function parseDailySeries(historyRows) {
    return historyRows
        .map((row) => Number(row.quantity_sold || row.total_quantity || 0))
        .filter((value) => Number.isFinite(value) && value >= 0);
}

function average(values) {
    if (!values.length) return 0;
    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
}

function standardDeviation(values) {
    if (!values.length) return 0;
    const avg = average(values);
    const variance = average(values.map((value) => (value - avg) ** 2));
    return Math.sqrt(variance);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function addDays(date, days) {
    const updated = new Date(date);
    updated.setDate(updated.getDate() + days);
    return updated;
}

function buildForecast(historyRows, days) {
    const series = parseDailySeries(historyRows);
    const baselineSeries = series.length > 0 ? series : [0];

    const recentWindow = baselineSeries.slice(-7);
    const previousWindow = baselineSeries.slice(-14, -7);

    const recentAverage = average(recentWindow.length ? recentWindow : baselineSeries);
    const previousAverage = average(previousWindow.length ? previousWindow : recentWindow);
    const trendPerWeek = recentAverage - previousAverage;

    const stdDev = standardDeviation(baselineSeries);
    const volatility = recentAverage > 0 ? stdDev / recentAverage : 1;
    const modelAccuracy = Math.max(55, Math.min(96, Number((95 - volatility * 12).toFixed(2))));

    const today = new Date();
    const predictions = [];

    for (let dayOffset = 1; dayOffset <= days; dayOffset += 1) {
        const trendComponent = trendPerWeek * (dayOffset / 7);
        const prediction = Math.max(0, Number((recentAverage + trendComponent).toFixed(2)));
        const confidenceDelta = Math.max(1, Number((prediction * (0.18 + volatility * 0.05)).toFixed(2)));

        predictions.push({
            forecast_date: formatDate(addDays(today, dayOffset)),
            predicted_demand: prediction,
            confidence_lower: Math.max(0, Number((prediction - confidenceDelta).toFixed(2))),
            confidence_upper: Number((prediction + confidenceDelta).toFixed(2)),
            model_accuracy: modelAccuracy,
        });
    }

    return {
        predictions,
        model_accuracy: modelAccuracy,
        average_daily_demand: Number(recentAverage.toFixed(2)),
    };
}

function computeStockoutRisk(currentStock, predictions) {
    const avgDemand = average(predictions.map((prediction) => Number(prediction.predicted_demand || 0)));

    if (avgDemand <= 0) {
        return {
            at_risk: false,
            estimated_days_to_stockout: null,
            projected_stockout_date: null,
            average_daily_demand: Number(avgDemand.toFixed(2)),
        };
    }

    const daysToStockout = currentStock / avgDemand;
    const atRisk = daysToStockout <= predictions.length;

    return {
        at_risk: atRisk,
        estimated_days_to_stockout: Number(daysToStockout.toFixed(2)),
        projected_stockout_date: atRisk
            ? formatDate(addDays(new Date(), Math.ceil(daysToStockout)))
            : null,
        average_daily_demand: Number(avgDemand.toFixed(2)),
    };
}

module.exports = {
    buildForecast,
    computeStockoutRisk,
};
