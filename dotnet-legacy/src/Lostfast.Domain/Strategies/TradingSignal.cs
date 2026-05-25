namespace Lostfast.Domain.Strategies;

public enum StrategyType
{
    TrendFollowing,
    MeanReversion,
    Breakout,
    Scalping,
    SmartMoneyConcept,
    SupportResistance,
    Pullback,
    DayTrading,
    SwingTrading,
    PositionTrading,
    Grid,
    Arbitrage,
    VolatilitySession
}

public sealed record TradingSignal(
    StrategyType Strategy,
    string Symbol,
    DateTime Timestamp,
    string Direction, // "Long", "Short", "Neutral"
    double Strength,  // 0.0 - 1.0
    string Reason,
    double SuggestedRiskPercent = 0.5
);

public sealed record StrategyParameters(
    int LookbackPeriod = 20,
    double Threshold = 0.5,
    double RiskPercent = 0.5,
    Dictionary<string, object>? Custom = null
);
