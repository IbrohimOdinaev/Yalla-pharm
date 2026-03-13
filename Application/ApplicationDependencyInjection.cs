using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Yalla.Application.Abstractions;
using Yalla.Application.Services;
using Yalla.Application.Validation;

namespace Yalla.Application;

public static class DependencyInjection
{
  public static IServiceCollection AddApplication(this IServiceCollection services)
  {
    services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();
    services.AddScoped<IPaymentService, StubPaymentService>();
    services.AddScoped<IAuthService, AuthService>();
    services.AddScoped<IClientService, ClientService>();
    services.AddScoped<IMedicineService, MedicineService>();
    services.AddScoped<IOrderService, OrderService>();
    services.AddScoped<IRefundRequestService, RefundRequestService>();
    services.AddScoped<IPharmacyWorkerService, PharmacyWorkerService>();
    services.AddScoped<IUserReadService, UserReadService>();
    services.AddTransient(typeof(IValidator<>), typeof(RequestDtoFluentValidator<>));

    return services;
  }
}
