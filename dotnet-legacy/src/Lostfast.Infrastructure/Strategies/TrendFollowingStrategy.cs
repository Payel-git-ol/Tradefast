using Lostfast.Domain.Strategies;
using Lostfast.Application.Strategies;

namespace Lostfast.Infrastructure.Strategies;

public sealed class TrendFollowingStrategy : IStrategy
{
    public StrategyType Type => StrategyType.TrendFollowing;

    public TradingSignal Evaluate(IReadOnlyList<Candle> candles, StrategyParameters parameters)
    {
        if (candles.Count < 50) 
            return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0, "Not enough data");

        var closes = candles.Select(c => c.Close).ToArray();

        var sma20 = TechnicalIndicators.Sma(closes, 20);
        var sma50 = TechnicalIndicators.Sma(closes, 50);

        double currentPrice = closes.Last();
        double slope = TechnicalIndicators.LinearRegressionSlope(closes.TakeLast(20).ToArray());

        bool aboveBoth = currentPrice > sma20.Last() && currentPrice > sma50.Last();
        bool strongUptrend = slope > 0 && aboveBoth;

        bool belowBoth = currentPrice < sma20.Last() && currentPrice < sma50.Last();
        bool strongDowntrend = slope < 0 && belowBoth;

        if (strongUptrend)
        {
            return new TradingSignal(
                Type, 
                "", 
                DateTime.UtcNow, 
                "Long", 
                Math.Min(0.95, Math.Abs(slope) * 10), 
                "Price above SMA20 & SMA50 with positive slope (Higher Highs structure confirmed)");
        }

        if (strongDowntrend)
        {
            return new TradingSignal(
                Type, 
                "", 
                DateTime.UtcNow, 
                "Short", 
                Math.Min(0.95, Math.Abs(slope) * 10), 
                "Price below SMA20 & SMA50 with negative slope (Lower Lows structure confirmed)");
        }

        return new TradingSignal(Type, "", DateTime.UtcNow, "Neutral", 0.2, "No clear trend structure");
    }
}
