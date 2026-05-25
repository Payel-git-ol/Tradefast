using Lostfast.Domain.Journal;
using Lostfast.Application.Common.Interfaces;

namespace Lostfast.Application.Risk.Commands;

public sealed record CheckTradeRiskCommand(Trade ProposedTrade);

public sealed class CheckTradeRiskCommandHandler
{
    private readonly IPreTradeRiskValidator _validator;

    public CheckTradeRiskCommandHandler(IPreTradeRiskValidator validator)
    {
        _validator = validator;
    }

    public async Task<RiskCheckResult> Handle(CheckTradeRiskCommand command, CancellationToken ct = default)
    {
        var result = await _validator.ValidateAsync(command.ProposedTrade, ct);

        // Here we can add additional cross-cutting risk logic later (audit, notifications, etc.)
        return result;
    }
}
