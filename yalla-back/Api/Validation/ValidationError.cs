namespace Api.Validation;

internal sealed record ValidationError(string Field, string Message);
