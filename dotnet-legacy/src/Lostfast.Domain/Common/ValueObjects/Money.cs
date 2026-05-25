namespace Lostfast.Domain.Common.ValueObjects;

public sealed record Money(decimal Amount, string Currency = "USD")
{
    public static Money Zero(string currency = "USD") => new(0, currency);

    public static Money Create(decimal amount, string currency = "USD")
    {
        if (amount < 0)
            throw new ArgumentException("Amount cannot be negative", nameof(amount));

        return new Money(amount, currency.ToUpperInvariant());
    }

    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException("Cannot add money with different currencies");

        return new Money(Amount + other.Amount, Currency);
    }

    public Money Subtract(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException("Cannot subtract money with different currencies");

        var result = Amount - other.Amount;
        if (result < 0)
            throw new InvalidOperationException("Resulting amount cannot be negative");

        return new Money(result, Currency);
    }

    public bool IsGreaterThan(Money other) => Currency == other.Currency && Amount > other.Amount;
    public bool IsZero => Amount == 0;

    public override string ToString() => $"{Amount:F2} {Currency}";
}
