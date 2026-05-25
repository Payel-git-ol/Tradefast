using Lostfast.Domain.Strategies;
using Lostfast.Application.Strategies;

namespace Lostfast.Infrastructure.Strategies;

public sealed class MeanReversionStrategy : IStrategy
{
    public StrategyType Type => StrategyType.MeanReversion;

    public TradingSignal Evaluate(IReadOnlyList<Candle> candles, StrategyParameters parameters)
    {
        if (candles.Count < 30)
            return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0, "Not enough data");

        var closes = candles.Select(c => c.Close).ToArray();
        var (upper, middle, lower) = TechnicalIndicators.BollingerBands(closes, 20, 2.0);

        double currentPrice = closes.Last();
        double upperBand = upper.Last();
        double lowerBand = lower.Last();
        double middleBand = middle.Last();

        double distanceToUpper = (upperBand - currentPrice) / (upperBand - middleBand);
        double distanceToLower = (currentPrice - lowerBand) / (middleBand - lowerBand);

        if (currentPrice > upperBand)
        {
            return new TradingSignal(Type, "", DateTime.UtcNow, "Short", 0.8,
                "Price outside upper Bollinger Band - mean reversion short opportunity");
        }

        if (currentPrice < lowerBand)
        {
            return new TradingSignal(Type, "", DateTime.UtcNow, "Long", 0.8,
                "Price outside lower Bollinger Band - mean reversion long opportunity");
        }

        return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0.3, "Price within normal Bollinger range");
    }
}
