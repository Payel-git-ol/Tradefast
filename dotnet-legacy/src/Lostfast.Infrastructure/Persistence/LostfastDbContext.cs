using Microsoft.EntityFrameworkCore;
using Lostfast.Domain.Journal;
using Lostfast.Domain.Risk;

namespace Lostfast.Infrastructure.Persistence;

public class LostfastDbContext : DbContext
{
    public DbSet<Trade> Trades => Set<Trade>();
    public DbSet<RiskLimit> RiskLimits => Set<RiskLimit>();

    public LostfastDbContext(DbContextOptions<LostfastDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Will add configurations in separate files (small files rule)
        base.OnModelCreating(modelBuilder);
    }
}
