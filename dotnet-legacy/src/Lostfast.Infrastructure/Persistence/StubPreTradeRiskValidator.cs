using Lostfast.Domain.Journal;
using Lostfast.Application.Common.Interfaces;

namespace Lostfast.Infrastructure.Persistence;

public class StubPreTradeRiskValidator : IPreTradeRiskValidator
{
    public Task<RiskCheckResult> ValidateAsync(Trade proposedTrade, CancellationToken cancellationToken = default)
    {
        // Very basic stub for MVP skeleton — always approve for now
        // Real implementation will check current exposure, daily loss, limits etc.
        return Task.FromResult(new RiskCheckResult(
            IsApproved: true,
            RejectionReason: null,
            Warnings: new[] { "Stub validator — replace with real logic" }
        ));
    }
}
