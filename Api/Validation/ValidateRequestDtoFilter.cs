using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Validation;

public sealed class ValidateRequestDtoFilter : IActionFilter
{
  public void OnActionExecuting(ActionExecutingContext context)
  {
    var errors = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);

    foreach (var argument in context.ActionArguments.Values)
    {
      if (argument is null)
        continue;

      var argumentNamespace = argument.GetType().Namespace;
      if (!string.Equals(argumentNamespace, "Yalla.Application.DTO.Request", StringComparison.Ordinal))
        continue;

      var argumentErrors = RequestDtoValidator.Validate(argument);
      foreach (var validationError in argumentErrors)
      {
        if (!errors.TryGetValue(validationError.Field, out var fieldErrors))
        {
          fieldErrors = [];
          errors[validationError.Field] = fieldErrors;
        }

        fieldErrors.Add(validationError.Message);
      }
    }

    if (errors.Count == 0)
      return;

    var modelState = errors.ToDictionary(
      x => x.Key,
      x => x.Value.Distinct(StringComparer.Ordinal).ToArray(),
      StringComparer.OrdinalIgnoreCase);

    var problemDetails = new ValidationProblemDetails(modelState)
    {
      Status = StatusCodes.Status400BadRequest,
      Title = "Request validation failed."
    };

    context.Result = new BadRequestObjectResult(problemDetails);
  }

  public void OnActionExecuted(ActionExecutedContext context)
  {
  }
}
