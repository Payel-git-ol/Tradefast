using Lostfast.Domain.Strategies;
using Lostfast.Application.Strategies;

namespace Lostfast.Infrastructure.Strategies;

/// <summary>
/// Simplified Smart Money Concept style strategy (Order Blocks + BOS)
/// </summary>
public sealed class SmartMoneyConceptStrategy : IStrategy
{
    public StrategyType Type => StrategyType.SmartMoneyConcept;

    public TradingSignal Evaluate(IReadOnlyList<Candle> candles, StrategyParameters parameters)
    {
        if (candles.Count < 30)
            return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0, "Not enough data");

        var closes = candles.Select(c => c.Close).ToArray();
        double current = closes.Last();
        double previous = closes[^2];

        // Very simplified BOS (Break of Structure) detection
        double recentHigh = candles.TakeLast(10).Max(c => c.High);
        double recentLow = candles.TakeLast(10).Min(c => c.Low);

        bool bullishBos = current > recentHigh && previous <= recentHigh;
        bool bearishBos = current < recentLow && previous >= recentLow;

        if (bullishBos)
            return new TradingSignal(Type, "", DateTime.UtcNow, "Long", 0.75, "Bullish BOS detected - potential SMC long");

        if (bearishBos)
            return new TradingSignal(Type, "", DateTime.UtcNow, "Short", 0.75, "Bearish BOS detected - potential SMC short");

        return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0.3, "No clear market structure break");
    }
}
