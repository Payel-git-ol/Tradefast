using Lostfast.Application.Common.Interfaces; // for RiskCheckResult
using Lostfast.Domain.Strategies;

namespace Lostfast.Application.Strategies;

/// <summary>
/// Used to persist every strategy decision + risk outcome.
/// This data will later be used to train our own model.
/// </summary>
public interface IStrategyAuditLogger
{
    Task LogAsync(
        string symbol,
        TradingSignal signal,
        RiskCheckResult? riskResult,
        string finalStatus,
        CancellationToken ct = default);
}
