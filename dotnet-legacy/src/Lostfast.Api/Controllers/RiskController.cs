using Microsoft.AspNetCore.Mvc;
using Lostfast.Application.Risk.Commands;
using Lostfast.Domain.Journal;
using Lostfast.Domain.Common.ValueObjects;

namespace Lostfast.Api.Controllers;

[ApiController]
[Route("api/risk")]
public class RiskController : ControllerBase
{
    private readonly CheckTradeRiskCommandHandler _handler;

    public RiskController(CheckTradeRiskCommandHandler handler)
    {
        _handler = handler;
    }

    [HttpPost("check-trade")]
    public async Task<IActionResult> CheckTrade([FromBody] CheckTradeRiskRequest request, CancellationToken ct)
    {
        var symbol = Symbol.Create(request.Symbol);
        var price = Money.Create(request.EntryPrice);

        var proposedTrade = Trade.Open(
            symbol,
            request.Side,
            price,
            request.Quantity,
            DateTime.UtcNow);

        var command = new CheckTradeRiskCommand(proposedTrade);
        var result = await _handler.Handle(command, ct);

        return Ok(result);
    }
}

public record CheckTradeRiskRequest(
    string Symbol,
    string Side,
    decimal EntryPrice,
    decimal Quantity
);
