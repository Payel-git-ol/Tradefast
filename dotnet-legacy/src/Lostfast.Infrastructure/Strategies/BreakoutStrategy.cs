using Lostfast.Domain.Strategies;
using Lostfast.Application.Strategies;

namespace Lostfast.Infrastructure.Strategies;

public sealed class BreakoutStrategy : IStrategy
{
    public StrategyType Type => StrategyType.Breakout;

    public TradingSignal Evaluate(IReadOnlyList<Candle> candles, StrategyParameters parameters)
    {
        if (candles.Count < 30)
            return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0, "Not enough data");

        var closes = candles.Select(c => c.Close).ToArray();
        var highs = candles.Select(c => c.High).ToArray();
        var lows = candles.Select(c => c.Low).ToArray();

        int lookback = Math.Min(20, candles.Count - 1);

        double recentHigh = highs.Skip(candles.Count - lookback).Take(lookback).Max();
        double recentLow = lows.Skip(candles.Count - lookback).Take(lookback).Min();

        double currentClose = closes.Last();
        double previousClose = closes[^2];

        bool bullishBreakout = currentClose > recentHigh && previousClose <= recentHigh;
        bool bearishBreakout = currentClose < recentLow && previousClose >= recentLow;

        if (bullishBreakout)
        {
            return new TradingSignal(Type, "", DateTime.UtcNow, "Long", 0.85,
                $"Bullish breakout above {recentHigh:F2} (20-period high)");
        }

        if (bearishBreakout)
        {
            return new TradingSignal(Type, "", DateTime.UtcNow, "Short", 0.85,
                $"Bearish breakout below {recentLow:F2} (20-period low)");
        }

        return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0.25, "No breakout detected");
    }
}
