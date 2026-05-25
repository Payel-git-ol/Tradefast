using Lostfast.Domain.Strategies;

namespace Lostfast.Application.Strategies;

public interface IStrategyEngine
{
    List<TradingSignal> EvaluateAll(IReadOnlyList<Candle> candles, StrategyParameters? parameters = null);
    TradingSignal GetStrongestSignal(IReadOnlyList<Candle> candles, StrategyParameters? parameters = null);
}
