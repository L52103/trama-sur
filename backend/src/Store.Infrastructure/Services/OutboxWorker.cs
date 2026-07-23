using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Store.Infrastructure.Persistence;

namespace Store.Infrastructure.Services;

internal sealed class OutboxWorker(IServiceScopeFactory scopeFactory, ILogger<OutboxWorker> logger) : BackgroundService
{
    private static readonly Action<ILogger, Guid, Exception?> LogFailure = LoggerMessage.Define<Guid>(LogLevel.Warning, new EventId(4201, "OutboxDeliveryFailure"), "Outbox delivery failed for message {MessageId}");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ProcessSafelyAsync(stoppingToken);
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
        while (await timer.WaitForNextTickAsync(stoppingToken)) await ProcessSafelyAsync(stoppingToken);
    }

    private async Task ProcessSafelyAsync(CancellationToken cancellationToken)
    {
        try
        {
            var ids = await ClaimAsync(cancellationToken);
            foreach (var id in ids) await DeliverAsync(id, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { }
        catch (Exception exception) { LogFailure(logger, Guid.Empty, exception); }
    }

    private async Task<IReadOnlyList<Guid>> ClaimAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var messages = await db.OutboxMessages.FromSqlRaw("SELECT * FROM outbox_messages WHERE status = 'Pending' AND available_at <= NOW() ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 20").ToListAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        foreach (var message in messages) message.Claim(now);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return messages.Select(x => x.Id).ToArray();
    }

    private async Task DeliverAsync(Guid id, CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<StoreDbContext>();
        var sender = scope.ServiceProvider.GetRequiredService<ITransactionalEmailSender>();
        var message = await db.OutboxMessages.SingleAsync(x => x.Id == id, cancellationToken);
        try
        {
            await sender.SendAsync(message.Type, message.PayloadJson, cancellationToken);
            message.MarkProcessed(DateTimeOffset.UtcNow);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var delay = TimeSpan.FromMinutes(Math.Min(60, Math.Pow(2, message.AttemptCount)));
            message.MarkFailed(exception.Message, DateTimeOffset.UtcNow.Add(delay), DateTimeOffset.UtcNow);
            LogFailure(logger, id, exception);
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}
