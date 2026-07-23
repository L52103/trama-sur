namespace Store.Application.Common;

public sealed class ExternalServiceUnavailableException(string message, Exception? innerException = null)
    : Exception(message, innerException);
