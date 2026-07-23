using System.Net.Http.Headers;
using Microsoft.Extensions.Options;

namespace Store.Infrastructure.Services;

public sealed class SupabaseStorageOptions
{
    public const string SectionName = "Supabase";
    public string Url { get; init; } = string.Empty;
    public string ServiceRoleKey { get; init; } = string.Empty;
    public string PublicBucket { get; init; } = "product-media";
}

public sealed record StoredMedia(string StorageKey, string PublicUrl);

public interface IMediaStorage
{
    Task<StoredMedia> UploadAsync(string key, Stream content, string contentType, CancellationToken cancellationToken);
    Task DeleteAsync(string key, CancellationToken cancellationToken);
}

internal sealed class SupabaseMediaStorage(HttpClient client, IOptions<SupabaseStorageOptions> options) : IMediaStorage
{
    private readonly SupabaseStorageOptions _options = options.Value;

    public async Task<StoredMedia> UploadAsync(string key, Stream content, string contentType, CancellationToken cancellationToken)
    {
        ValidateConfigured();
        using var request = new HttpRequestMessage(HttpMethod.Post, $"storage/v1/object/{Uri.EscapeDataString(_options.PublicBucket)}/{key}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ServiceRoleKey);
        request.Headers.Add("apikey", _options.ServiceRoleKey);
        request.Headers.Add("x-upsert", "false");
        request.Content = new StreamContent(content);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        request.Content.Headers.Add("Cache-Control", "public, max-age=31536000, immutable");
        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode) throw new HttpRequestException($"Supabase Storage respondió {(int)response.StatusCode}.");
        var publicUrl = $"{_options.Url.TrimEnd('/')}/storage/v1/object/public/{Uri.EscapeDataString(_options.PublicBucket)}/{key}";
        return new StoredMedia(key, publicUrl);
    }

    public async Task DeleteAsync(string key, CancellationToken cancellationToken)
    {
        ValidateConfigured();
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"storage/v1/object/{Uri.EscapeDataString(_options.PublicBucket)}/{key}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ServiceRoleKey);
        request.Headers.Add("apikey", _options.ServiceRoleKey);
        using var response = await client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode && response.StatusCode != System.Net.HttpStatusCode.NotFound) throw new HttpRequestException($"Supabase Storage respondió {(int)response.StatusCode}.");
    }

    private void ValidateConfigured()
    {
        if (!Uri.TryCreate(_options.Url, UriKind.Absolute, out _) || string.IsNullOrWhiteSpace(_options.ServiceRoleKey)) throw new InvalidOperationException("Supabase Storage no está configurado.");
    }
}
