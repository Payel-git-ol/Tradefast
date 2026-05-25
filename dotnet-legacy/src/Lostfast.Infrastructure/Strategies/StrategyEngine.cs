using Lostfast.Domain.Strategies;
using Lostfast.Application.Strategies;

namespace Lostfast.Infrastructure.Strategies;

public sealed class StrategyEngine : IStrategyEngine
{
    private readonly IEnumerable<IStrategy> _strategies;

    public StrategyEngine(IEnumerable<IStrategy> strategies)
    {
        _strategies = strategies;
    }

    public List<TradingSignal> EvaluateAll(IReadOnlyList<Candle> candles, StrategyParameters? parameters = null)
    {
        parameters ??= new StrategyParameters();

        var signals = new List<TradingSignal>();

        foreach (var strategy in _strategies)
        {
            try
            {
                var signal = strategy.Evaluate(candles, parameters);
                signals.Add(signal);
            }
            catch (Exception ex)
            {
                signals.Add(new TradingSignal(
                    strategy.Type, 
                    "", 
                    DateTime.UtcNow, 
                    "Neutral", 
                    0, 
                    $"Error: {ex.Message}"));
            }
        }

        return signals;
    }

    public TradingSignal GetStrongestSignal(IReadOnlyList<Candle> candles, StrategyParameters? parameters = null)
    {
        var all = EvaluateAll(candles, parameters);
        return all.OrderByDescending(s => s.Strength).FirstOrDefault() 
            ?? new TradingSignal(StrategyType.TrendFollowing, "", DateTime.UtcNow, "Neutral", 0, "No signals generated");
    }
}
