using FluentValidation;

namespace Yalla.Application.Validation;

public sealed class RequestDtoFluentValidator<T> : AbstractValidator<T>
{
  public RequestDtoFluentValidator()
  {
    RuleFor(x => x).Custom((dto, context) =>
    {
      if (dto is null)
        return;

      var errors = RequestDtoValidator.Validate(dto);
      foreach (var error in errors)
      {
        context.AddFailure(error.Field, error.Message);
      }
    });
  }
}
