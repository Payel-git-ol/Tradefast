using Lostfast.Domain.Common.ValueObjects;
using Lostfast.Domain.Strategies;

namespace Lostfast.Infrastructure.Strategies;

public static class PositionSizer
{
    /// <summary>
    /// Calculates position size based on risk percentage and stop distance (ATR-based).
    /// This is the core of disciplined risk management in Lostfast.
    /// </summary>
    public static (Money PositionSize, double Quantity) Calculate(
        double accountBalanceUsd,
        double riskPercent,
        double entryPrice,
        double stopPrice,
        double atr = 0,
        double atrMultiplier = 1.5)
    {
        if (accountBalanceUsd <= 0 || riskPercent <= 0)
            return (Money.Zero(), 0);

        double riskAmount = accountBalanceUsd * (riskPercent / 100.0);

        double stopDistance = Math.Abs(entryPrice - stopPrice);

        // If stop is not provided or invalid, fall back to ATR-based stop
        if (stopDistance < 0.0001 && atr > 0)
        {
            stopDistance = atr * atrMultiplier;
        }

        if (stopDistance < 0.0001)
            stopDistance = entryPrice * 0.02; // fallback 2% hard stop

        double quantity = riskAmount / stopDistance;

        // Round to reasonable precision for crypto
        quantity = Math.Round(quantity, 6);

        var positionValue = Money.Create((decimal)(quantity * entryPrice));

        return (positionValue, quantity);
    }
}
