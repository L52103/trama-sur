using Store.Domain.Common;

namespace Store.Domain.Operations;

public sealed class OutboxMessage : Entity
{
    private OutboxMessage() { }
    public OutboxMessage(string type, string payloadJson, DateTimeOffset availableAt)
    {
        Type = Guard.Required(type, nameof(type), 160);
        PayloadJson = Guard.Required(payloadJson, nameof(payloadJson), 10000);
        AvailableAt = availableAt;
    }
    public string Type { get; private set; } = string.Empty;
    public string PayloadJson { get; private set; } = "{}";
    public string Status { get; private set; } = "Pending";
    public int AttemptCount { get; private set; }
    public DateTimeOffset AvailableAt { get; private set; }
    public DateTimeOffset? ProcessedAt { get; private set; }
    public string? LastError { get; private set; }

    public void Claim(DateTimeOffset now)
    {
        if (Status != "Pending" || AvailableAt > now) throw new DomainException("El mensaje no está disponible.");
        Status = "Processing";
        AttemptCount++;
        LastError = null;
        Touch(now);
    }

    public void MarkProcessed(DateTimeOffset now)
    {
        Status = "Processed";
        ProcessedAt = now;
        LastError = null;
        Touch(now);
    }

    public void MarkFailed(string error, DateTimeOffset retryAt, DateTimeOffset now)
    {
        LastError = Guard.Required(error, nameof(error), 2000);
        Status = AttemptCount >= 8 ? "DeadLetter" : "Pending";
        AvailableAt = retryAt;
        Touch(now);
    }
}

public sealed class IdempotencyKey : Entity
{
    private IdempotencyKey() { }
    public IdempotencyKey(string scope, string keyHash, string requestHash, DateTimeOffset expiresAt)
    {
        Scope = Guard.Required(scope, nameof(scope), 80);
        KeyHash = Guard.Required(keyHash, nameof(keyHash), 128);
        RequestHash = Guard.Required(requestHash, nameof(requestHash), 128);
        ExpiresAt = expiresAt;
    }
    public string Scope { get; private set; } = string.Empty;
    public string KeyHash { get; private set; } = string.Empty;
    public string RequestHash { get; private set; } = string.Empty;
    public int ResponseStatusCode { get; private set; }
    public string ResponseBody { get; private set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; private set; }

    public void Complete(int responseStatusCode, string responseBody, DateTimeOffset now)
    {
        if (responseStatusCode is < 200 or > 599) throw new DomainException("Código de respuesta inválido.");
        ResponseStatusCode = responseStatusCode;
        ResponseBody = Guard.Required(responseBody, nameof(responseBody), 20000);
        Touch(now);
    }
}

public sealed class AuditLog : Entity
{
    private AuditLog() { }
    public AuditLog(Guid? userId, string action, string resourceType, string resourceId, string changesJson, string requestId, string ipAddressHash)
    {
        UserId = userId;
        Action = Guard.Required(action, nameof(action), 120);
        ResourceType = Guard.Required(resourceType, nameof(resourceType), 120);
        ResourceId = Guard.Required(resourceId, nameof(resourceId), 200);
        ChangesJson = Guard.Required(changesJson, nameof(changesJson), 20000);
        RequestId = Guard.Required(requestId, nameof(requestId), 100);
        IpAddressHash = Guard.Required(ipAddressHash, nameof(ipAddressHash), 128);
    }
    public Guid? UserId { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public string ResourceType { get; private set; } = string.Empty;
    public string ResourceId { get; private set; } = string.Empty;
    public string ChangesJson { get; private set; } = "{}";
    public string RequestId { get; private set; } = string.Empty;
    public string IpAddressHash { get; private set; } = string.Empty;
}

public sealed class ContentPage : Entity
{
    private readonly List<ContentPageVersion> _versions = [];
    private ContentPage() { }
    public ContentPage(string key, string name)
    {
        Key = Guard.Required(key, nameof(key), 100).ToLowerInvariant();
        Name = Guard.Required(name, nameof(name), 160);
    }
    public string Key { get; private set; } = string.Empty;
    public string Name { get; private set; } = string.Empty;
    public Guid? CurrentPublishedVersionId { get; private set; }
    public IReadOnlyCollection<ContentPageVersion> Versions => _versions;

    public ContentPageVersion CreateDraft(string contentJson, Guid createdByUserId)
    {
        var nextVersion = _versions.Count == 0 ? 1 : _versions.Max(x => x.VersionNumber) + 1;
        var version = new ContentPageVersion(Id, nextVersion, contentJson, createdByUserId);
        _versions.Add(version);
        return version;
    }

    public void Publish(ContentPageVersion version, Guid publishedByUserId, string note, DateTimeOffset now)
    {
        if (version.ContentPageId != Id) throw new DomainException("La versión no pertenece a esta página.");
        version.Publish(publishedByUserId, note, now);
        CurrentPublishedVersionId = version.Id;
        Touch(now);
    }
}

public sealed class ContentPageVersion : Entity
{
    private ContentPageVersion() { }
    public ContentPageVersion(Guid contentPageId, int versionNumber, string contentJson, Guid createdByUserId)
    {
        ContentPageId = contentPageId;
        if (versionNumber <= 0) throw new DomainException("La versión debe ser positiva.");
        VersionNumber = versionNumber;
        ContentJson = Guard.Required(contentJson, nameof(contentJson), 100000);
        CreatedByUserId = createdByUserId;
        Status = PublicationStatus.Draft;
    }
    public Guid ContentPageId { get; private set; }
    public int VersionNumber { get; private set; }
    public PublicationStatus Status { get; private set; }
    public string ContentJson { get; private set; } = "{}";
    public Guid CreatedByUserId { get; private set; }
    public Guid? PublishedByUserId { get; private set; }
    public DateTimeOffset? PublishedAt { get; private set; }
    public string PublicationNote { get; private set; } = string.Empty;

    public void Publish(Guid publishedByUserId, string note, DateTimeOffset now)
    {
        Status = PublicationStatus.Published;
        PublishedByUserId = publishedByUserId;
        PublishedAt = now;
        PublicationNote = string.IsNullOrWhiteSpace(note) ? "Publicación manual" : Guard.Required(note, nameof(note), 500);
        Touch(now);
    }
}

public sealed class MediaAsset : Entity
{
    private MediaAsset() { }
    public MediaAsset(string storageKey, string publicUrl, string contentType, long sizeBytes, string checksumSha256, string altText, Guid uploadedByUserId)
    {
        StorageKey = Guard.Required(storageKey, nameof(storageKey), 500);
        PublicUrl = Guard.Required(publicUrl, nameof(publicUrl), 1000);
        ContentType = Guard.Required(contentType, nameof(contentType), 100);
        if (sizeBytes <= 0) throw new DomainException("El archivo está vacío.");
        SizeBytes = sizeBytes;
        ChecksumSha256 = Guard.Required(checksumSha256, nameof(checksumSha256), 64);
        AltText = Guard.Required(altText, nameof(altText), 240);
        UploadedByUserId = uploadedByUserId;
    }
    public string StorageKey { get; private set; } = string.Empty;
    public string PublicUrl { get; private set; } = string.Empty;
    public string ContentType { get; private set; } = string.Empty;
    public long SizeBytes { get; private set; }
    public string ChecksumSha256 { get; private set; } = string.Empty;
    public string AltText { get; private set; } = string.Empty;
    public Guid UploadedByUserId { get; private set; }
    public bool IsDeleted { get; private set; }
    public void MarkDeleted(DateTimeOffset now) { IsDeleted = true; Touch(now); }
}
