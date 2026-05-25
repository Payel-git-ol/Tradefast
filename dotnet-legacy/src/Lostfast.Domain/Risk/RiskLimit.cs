using Lostfast.Domain.Common.ValueObjects;

namespace Lostfast.Domain.Risk;

public sealed class RiskLimit
{
    public Guid Id { get; private set; }
    public Money DailyLossLimit { get; private set; } = null!;
    public Money MaxPositionSize { get; private set; } = null!;
    public decimal MaxDrawdownPercent { get; private set; }
    public bool IsActive { get; private set; } = true;

    private RiskLimit() { }

    public static RiskLimit CreateDefault()
    {
        return new RiskLimit
        {
            Id = Guid.NewGuid(),
            DailyLossLimit = Money.Create(100, "USD"),      // conservative default
            MaxPositionSize = Money.Create(500, "USD"),
            MaxDrawdownPercent = 5m
        };
    }

    public void UpdateLimits(Money dailyLoss, Money maxPosition, decimal maxDrawdown)
    {
        if (dailyLoss.Amount <= 0 || maxPosition.Amount <= 0 || maxDrawdown <= 0)
            throw new ArgumentException("Limits must be positive");

        DailyLossLimit = dailyLoss;
        MaxPositionSize = maxPosition;
        MaxDrawdownPercent = maxDrawdown;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
