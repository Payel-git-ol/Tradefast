using Lostfast.Domain.Strategies;
using Lostfast.Application.Strategies;

namespace Lostfast.Infrastructure.Strategies;

public sealed class SupportResistanceStrategy : IStrategy
{
    public StrategyType Type => StrategyType.SupportResistance;

    public TradingSignal Evaluate(IReadOnlyList<Candle> candles, StrategyParameters parameters)
    {
        if (candles.Count < 30) return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0, "Insufficient data");

        var closes = candles.Select(c => c.Close).ToArray();
        double current = closes.Last();

        // Simple recent support/resistance
        double support = candles.TakeLast(15).Min(c => c.Low);
        double resistance = candles.TakeLast(15).Max(c => c.High);

        if (current <= support * 1.001)
            return new TradingSignal(Type, "", DateTime.UtcNow, "Long", 0.65, "Price at support zone");

        if (current >= resistance * 0.999)
            return new TradingSignal(Type, "", DateTime.UtcNow, "Short", 0.65, "Price at resistance zone");

        return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0.3, "Price between support/resistance");
    }
}
