using Lostfast.Domain.Common.ValueObjects;
using Lostfast.Domain.Journal;

namespace Lostfast.Application.Common.Interfaces;

public interface IPreTradeRiskValidator
{
    Task<RiskCheckResult> ValidateAsync(Trade proposedTrade, CancellationToken cancellationToken = default);
}

public record RiskCheckResult(
    bool IsApproved,
    string? RejectionReason,
    Money? SuggestedMaxSize = null,
    string[]? Warnings = null
);
