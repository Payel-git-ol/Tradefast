using Lostfast.Application.Common.Interfaces;
using Lostfast.Application.Strategies;
using Lostfast.Domain.Strategies;

namespace Lostfast.Infrastructure.Strategies;

/// <summary>
/// Simple in-memory audit logger.
/// Later we will replace this with a real repository that writes to DB
/// (for building training dataset for our own model).
/// </summary>
public sealed class InMemoryStrategyAuditLogger : IStrategyAuditLogger
{
    private readonly List<StrategyExecutionLog> _logs = new();

    public Task LogAsync(
        string symbol,
        TradingSignal signal,
        RiskCheckResult? riskResult,
        string finalStatus,
        CancellationToken ct = default)
    {
        _logs.Add(new StrategyExecutionLog(
            DateTime.UtcNow,
            symbol,
            signal.Strategy.ToString(),
            signal.Direction,
            signal.Strength,
            signal.Reason,
            riskResult?.IsApproved,
            riskResult?.RejectionReason,
            finalStatus
        ));

        return Task.CompletedTask;
    }

    public IReadOnlyList<StrategyExecutionLog> GetAll() => _logs.AsReadOnly();
}

public sealed record StrategyExecutionLog(
    DateTime Timestamp,
    string Symbol,
    string Strategy,
    string Direction,
    double Strength,
    string Reason,
    bool? RiskApproved,
    string? RiskRejectionReason,
    string FinalStatus
);
