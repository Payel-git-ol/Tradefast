using Lostfast.Domain.Strategies;

namespace Lostfast.Application.Strategies;

public interface IStrategy
{
    StrategyType Type { get; }

    TradingSignal Evaluate(
        IReadOnlyList<Candle> candles,
        StrategyParameters parameters);
}
