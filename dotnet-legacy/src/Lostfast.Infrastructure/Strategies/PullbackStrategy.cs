using Lostfast.Domain.Strategies;
using Lostfast.Application.Strategies;

namespace Lostfast.Infrastructure.Strategies;

public sealed class PullbackStrategy : IStrategy
{
    public StrategyType Type => StrategyType.Pullback;

    public TradingSignal Evaluate(IReadOnlyList<Candle> candles, StrategyParameters parameters)
    {
        if (candles.Count < 25) return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0, "Not enough data");

        var closes = candles.Select(c => c.Close).ToArray();
        double current = closes.Last();

        var sma = TechnicalIndicators.Sma(closes, 20);
        double smaValue = sma.Last();

        bool inUptrend = current > smaValue;
        bool inDowntrend = current < smaValue;

        // Simple pullback detection: price retraced but still in trend
        if (inUptrend)
        {
            double recentHigh = candles.TakeLast(8).Max(c => c.High);
            bool pulledBack = current < recentHigh * 0.985; // pulled back ~1.5%

            if (pulledBack)
                return new TradingSignal(Type, "", DateTime.UtcNow, "Long", 0.7, "Pullback in uptrend - good entry zone");
        }

        if (inDowntrend)
        {
            double recentLow = candles.TakeLast(8).Min(c => c.Low);
            bool pulledBack = current > recentLow * 1.015;

            if (pulledBack)
                return new TradingSignal(Type, "", DateTime.UtcNow, "Short", 0.7, "Pullback in downtrend - good entry zone");
        }

        return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0.35, "No clear pullback setup");
    }
}
