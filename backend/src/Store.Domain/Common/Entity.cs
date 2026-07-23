namespace Store.Domain.Common;

public abstract class Entity
{
    public Guid Id { get; protected init; } = Guid.CreateVersion7();
    public DateTimeOffset CreatedAt { get; protected set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; protected set; } = DateTimeOffset.UtcNow;

    protected void Touch(DateTimeOffset now) => UpdatedAt = now;
}

public static class Guard
{
    public static string Required(string value, string name, int maxLength)
    {
        var normalized = value.Trim();
        if (normalized.Length is 0 or > 5000 || normalized.Length > maxLength)
        {
            throw new DomainException($"{name} es obligatorio y admite hasta {maxLength} caracteres.");
        }

        return normalized;
    }

    public static long NonNegative(long value, string name)
    {
        if (value < 0) throw new DomainException($"{name} no puede ser negativo.");
        return value;
    }
}

public sealed class DomainException(string message) : Exception(message);

