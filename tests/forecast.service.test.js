const { buildForecast, computeStockoutRisk } = require('../services/forecastService');

describe('forecastService', () => {
  test('buildForecast returns requested horizon with confidence bounds', () => {
    const history = [
      { sale_date: '2026-03-01', quantity_sold: 4 },
      { sale_date: '2026-03-02', quantity_sold: 5 },
      { sale_date: '2026-03-03', quantity_sold: 6 },
      { sale_date: '2026-03-04', quantity_sold: 5 },
      { sale_date: '2026-03-05', quantity_sold: 7 },
      { sale_date: '2026-03-06', quantity_sold: 6 },
      { sale_date: '2026-03-07', quantity_sold: 8 },
    ];

    const result = buildForecast(history, 15);

    expect(result.predictions).toHaveLength(15);
    expect(result.model_accuracy).toBeGreaterThanOrEqual(55);
    expect(result.model_accuracy).toBeLessThanOrEqual(96);

    result.predictions.forEach((row) => {
      expect(row.confidence_upper).toBeGreaterThanOrEqual(row.predicted_demand);
      expect(row.confidence_lower).toBeLessThanOrEqual(row.predicted_demand);
    });
  });

  test('computeStockoutRisk marks at-risk when projected depletion is within horizon', () => {
    const predictions = [
      { predicted_demand: 2.5 },
      { predicted_demand: 2.5 },
      { predicted_demand: 2.5 },
      { predicted_demand: 2.5 },
      { predicted_demand: 2.5 },
      { predicted_demand: 2.5 },
      { predicted_demand: 2.5 },
    ];

    const risk = computeStockoutRisk(10, predictions);

    expect(risk.at_risk).toBe(true);
    expect(risk.estimated_days_to_stockout).toBeCloseTo(4, 1);
    expect(risk.projected_stockout_date).toBeTruthy();
  });
});
