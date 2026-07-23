using FluentValidation;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Store.Application.Common;
using Store.Domain.Common;

namespace Store.Api.Infrastructure;

public sealed class ApiExceptionHandler(IProblemDetailsService problemDetails, ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    private static readonly Action<ILogger, string, Exception?> LogUnhandled = LoggerMessage.Define<string>(LogLevel.Error, new EventId(5000, "UnhandledException"), "Unhandled exception for request {RequestId}");
    private static readonly Action<ILogger, string, string, Exception?> LogHandled = LoggerMessage.Define<string, string>(LogLevel.Warning, new EventId(4000, "HandledException"), "Handled exception {ExceptionType} for request {RequestId}");

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var (status, title, detail) = exception switch
        {
            ValidationException => (StatusCodes.Status400BadRequest, "Solicitud inválida", "Revisa los campos enviados."),
            DomainException domain => (StatusCodes.Status422UnprocessableEntity, "No se pudo completar la operación", domain.Message),
            KeyNotFoundException => (StatusCodes.Status404NotFound, "Recurso no encontrado", "El recurso solicitado no existe."),
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "No autorizado", "La sesión o validación de seguridad no es válida."),
            BadHttpRequestException => (StatusCodes.Status400BadRequest, "Solicitud inválida", "La solicitud no tiene un formato válido."),
            DbUpdateConcurrencyException => (StatusCodes.Status409Conflict, "Conflicto de concurrencia", "Los datos cambiaron mientras realizabas la operación. Intenta nuevamente."),
            ExternalServiceUnavailableException unavailable => (StatusCodes.Status503ServiceUnavailable, "Servicio temporalmente no disponible", unavailable.Message),
            _ => (StatusCodes.Status500InternalServerError, "Error interno", "Ocurrió un error inesperado. Usa el identificador de solicitud al contactar soporte.")
        };
        if (status >= 500) LogUnhandled(logger, httpContext.TraceIdentifier, exception);
        else LogHandled(logger, exception.GetType().Name, httpContext.TraceIdentifier, null);
        httpContext.Response.StatusCode = status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = new ProblemDetails { Status = status, Title = title, Detail = detail, Instance = httpContext.Request.Path, Extensions = { ["requestId"] = httpContext.TraceIdentifier } },
            Exception = exception
        });
    }
}
