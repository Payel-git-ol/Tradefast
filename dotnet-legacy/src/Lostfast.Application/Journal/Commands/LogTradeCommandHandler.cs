using Lostfast.Domain.Journal;
using Lostfast.Domain.Common.ValueObjects;

namespace Lostfast.Application.Journal.Commands;

public sealed class LogTradeCommandHandler
{
    // In real implementation this will use ITradeRepository (to be added in Infrastructure)
    public Task<Guid> Handle(LogTradeCommand command, CancellationToken ct = default)
    {
        var symbol = Symbol.Create(command.Symbol);
        var price = Money.Create(command.EntryPrice);

        var trade = Trade.Open(
            symbol,
            command.Side,
            price,
            command.Quantity,
            command.EntryTime);

        if (!string.IsNullOrWhiteSpace(command.Notes))
        {
            // For now just set via reflection or we'll improve later
        }

        if (command.Tags != null)
        {
            foreach (var tag in command.Tags)
                trade.AddTag(tag);
        }

        // TODO: persist via repository + publish domain events
        return Task.FromResult(trade.Id);
    }
}
