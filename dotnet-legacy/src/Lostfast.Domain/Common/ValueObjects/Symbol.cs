namespace Lostfast.Domain.Common.ValueObjects;

public sealed record Symbol(string Value)
{
    public static Symbol Create(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("Symbol cannot be empty", nameof(value));

        // Basic validation for crypto pairs (e.g. BTCUSDT, ETHBTC)
        var upper = value.Trim().ToUpperInvariant();
        if (upper.Length < 3 || upper.Length > 20)
            throw new ArgumentException("Symbol length must be between 3 and 20 characters", nameof(value));

        return new Symbol(upper);
    }

    public override string ToString() => Value;
}
