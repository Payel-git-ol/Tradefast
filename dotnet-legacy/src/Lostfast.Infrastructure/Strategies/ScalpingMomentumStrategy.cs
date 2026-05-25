using Lostfast.Domain.Strategies;
using Lostfast.Application.Strategies;

namespace Lostfast.Infrastructure.Strategies;

public sealed class ScalpingMomentumStrategy : IStrategy
{
    public StrategyType Type => StrategyType.Scalping;

    public TradingSignal Evaluate(IReadOnlyList<Candle> candles, StrategyParameters parameters)
    {
        if (candles.Count < 20)
            return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0, "Not enough data");

        var closes = candles.Select(c => c.Close).ToArray();
        var rsi = TechnicalIndicators.Rsi(closes, 14);

        double currentRsi = rsi.Last();
        double previousRsi = rsi[^2];

        if (double.IsNaN(currentRsi))
            return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0, "RSI not ready");

        // Oversold bounce for long (scalping style)
        if (currentRsi < 30 && previousRsi < currentRsi)
        {
            return new TradingSignal(Type, "", DateTime.UtcNow, "Long", 0.7,
                $"RSI oversold bounce at {currentRsi:F1} - scalping long opportunity");
        }

        // Overbought reversal for short
        if (currentRsi > 70 && previousRsi > currentRsi)
        {
            return new TradingSignal(Type, "", DateTime.UtcNow, "Short", 0.7,
                $"RSI overbought reversal at {currentRsi:F1} - scalping short opportunity");
        }

        return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0.4, $"RSI at {currentRsi:F1} - no extreme");
    }
}
