using Lostfast.Domain.Common.ValueObjects;

namespace Lostfast.Domain.Journal;

public sealed class Trade
{
    public Guid Id { get; private set; }
    public Symbol Symbol { get; private set; } = null!;
    public string Side { get; private set; } = null!; // "Buy" or "Sell"
    public Money EntryPrice { get; private set; } = null!;
    public Money? ExitPrice { get; private set; }
    public decimal Quantity { get; private set; }
    public DateTime EntryTime { get; private set; }
    public DateTime? ExitTime { get; private set; }
    public string? Notes { get; private set; }
    public List<string> Tags { get; private set; } = new();

    private Trade() { } // For EF

    public static Trade Open(
        Symbol symbol,
        string side,
        Money entryPrice,
        decimal quantity,
        DateTime entryTime)
    {
        if (quantity <= 0)
            throw new ArgumentException("Quantity must be positive");

        return new Trade
        {
            Id = Guid.NewGuid(),
            Symbol = symbol,
            Side = side,
            EntryPrice = entryPrice,
            Quantity = quantity,
            EntryTime = entryTime
        };
    }

    public void Close(Money exitPrice, DateTime exitTime, string? notes = null)
    {
        if (ExitTime.HasValue)
            throw new InvalidOperationException("Trade is already closed");

        ExitPrice = exitPrice;
        ExitTime = exitTime;
        Notes = notes;
    }

    public void AddTag(string tag)
    {
        if (!string.IsNullOrWhiteSpace(tag) && !Tags.Contains(tag))
            Tags.Add(tag.Trim());
    }
}
