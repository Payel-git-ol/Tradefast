namespace Lostfast.Domain.Strategies;

public sealed record Candle(
    DateTime Timestamp,
    double Open,
    double High,
    double Low,
    double Close,
    double Volume = 0
);
