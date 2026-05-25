namespace Lostfast.Application.Journal.Commands;

public sealed record LogTradeCommand(
    string Symbol,
    string Side,
    decimal EntryPrice,
    decimal Quantity,
    DateTime EntryTime,
    string? Notes = null,
    string[]? Tags = null
);
